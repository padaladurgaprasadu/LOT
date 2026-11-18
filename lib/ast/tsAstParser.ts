/**
 * TypeScript / JavaScript AST Signature & Reference Parser
 * Utilizes the official TypeScript Compiler API (ts.createSourceFile)
 * Extracts signatures (without implementation bodies), docstrings, and
 * outgoing identifier references for call/use dependency tracking.
 */

import ts from "typescript";
import { AstSymbol, FileImport, FileParseResult, SymbolKind } from "./types";

const TS_KEYWORD_SET = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "enum", "export", "extends", "false", "finally",
  "for", "function", "if", "import", "in", "instanceof", "new", "null",
  "return", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "as", "implements", "interface", "let",
  "package", "private", "protected", "public", "static", "yield", "any",
  "boolean", "constructor", "declare", "get", "is", "module", "require",
  "number", "set", "string", "symbol", "type", "from", "of", "undefined",
  "unknown", "never", "object", "bigint", "async", "await", "readonly"
]);

/**
 * Clean JSDoc comment text into a readable summary string
 */
function cleanDocstring(rawComment: string): string {
  const lines = rawComment
    .replace(/^\/\*\*?/, "")
    .replace(/\*\/$/, "")
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*\*\s?/, "").trim())
    .filter(line => line.length > 0 && !line.startsWith("@"));

  return lines.slice(0, 3).join(" ");
}

/**
 * Extract leading JSDoc / docstring comments immediately preceding an AST node
 */
function extractDocstring(sourceFile: ts.SourceFile, node: ts.Node): string | undefined {
  const fullText = sourceFile.getFullText();
  const commentRanges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!commentRanges || commentRanges.length === 0) return undefined;

  // Take the closest comment to the node
  const lastRange = commentRanges[commentRanges.length - 1];
  const commentText = fullText.substring(lastRange.pos, lastRange.end);
  if (commentText.startsWith("/**") || commentText.startsWith("/*") || commentText.startsWith("//")) {
    const cleaned = cleanDocstring(commentText);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  return undefined;
}

/**
 * Determine ScriptKind based on file extension
 */
function getScriptKind(filePath: string): ts.ScriptKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (lower.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Collect all outgoing identifier references inside a node (including its body)
 */
function collectOutgoingRefs(node: ts.Node, selfName: string): Set<string> {
  const refs = new Set<string>();

  function walk(current: ts.Node) {
    if (ts.isIdentifier(current)) {
      const text = current.text;
      if (
        text !== selfName &&
        text.length > 1 &&
        !TS_KEYWORD_SET.has(text) &&
        !/^[0-9]+$/.test(text)
      ) {
        refs.add(text);
      }
    }
    current.forEachChild(walk);
  }

  walk(node);
  return refs;
}

/**
 * Format interface member signatures
 */
function formatInterfaceMembers(sourceFile: ts.SourceFile, members: ts.NodeArray<ts.TypeElement>): string {
  const parts: string[] = [];
  for (const member of members) {
    const text = member.getText(sourceFile).trim().replace(/\r?\n\s*/g, " ");
    if (text) {
      parts.push(text.endsWith(";") ? text : text + ";");
    }
  }
  if (parts.length === 0) return "{}";
  if (parts.length <= 4) {
    return `{ ${parts.join(" ")} }`;
  }
  return `{\n  ${parts.slice(0, 10).join("\n  ")}\n  ${parts.length > 10 ? `// ... +${parts.length - 10} more members` : ""}\n}`;
}

/**
 * Format class member signature without method body
 */
function formatMethodSignature(sourceFile: ts.SourceFile, member: ts.ClassElement): { name: string; signature: string } | null {
  if (ts.isMethodDeclaration(member)) {
    const name = member.name.getText(sourceFile);
    const modifiers = member.modifiers ? member.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
    const typeParams = member.typeParameters ? `<${member.typeParameters.map(p => p.getText(sourceFile)).join(", ")}>` : "";
    const params = member.parameters.map(p => p.getText(sourceFile)).join(", ");
    const returnType = member.type ? `: ${member.type.getText(sourceFile)}` : "";
    return {
      name,
      signature: `${modifiers}${name}${typeParams}(${params})${returnType}`.trim()
    };
  }

  if (ts.isConstructorDeclaration(member)) {
    const params = member.parameters.map(p => p.getText(sourceFile)).join(", ");
    return {
      name: "constructor",
      signature: `constructor(${params})`
    };
  }

  if (ts.isGetAccessorDeclaration(member)) {
    const name = member.name.getText(sourceFile);
    const modifiers = member.modifiers ? member.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
    const returnType = member.type ? `: ${member.type.getText(sourceFile)}` : "";
    return {
      name,
      signature: `${modifiers}get ${name}()${returnType}`.trim()
    };
  }

  if (ts.isSetAccessorDeclaration(member)) {
    const name = member.name.getText(sourceFile);
    const modifiers = member.modifiers ? member.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
    const params = member.parameters.map(p => p.getText(sourceFile)).join(", ");
    return {
      name,
      signature: `${modifiers}set ${name}(${params})`.trim()
    };
  }

  return null;
}

/**
 * Parse TypeScript / JavaScript code and extract symbol signatures & references.
 */
export function parseTypeScriptAst(filePath: string, content: string): AstSymbol[] {
  const result = parseTypeScriptFile(filePath, content);
  return result.symbols;
}

/**
 * Comprehensive parser returning symbols, imports, and exports.
 */
export function parseTypeScriptFile(filePath: string, content: string): FileParseResult {
  const cleanPath = filePath.replace(/\\/g, "/");
  const scriptKind = getScriptKind(cleanPath);

  const sourceFile = ts.createSourceFile(
    cleanPath,
    content,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
    scriptKind
  );

  const symbols: AstSymbol[] = [];
  const imports: FileImport[] = [];
  const exports: string[] = [];

  function visit(node: ts.Node) {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const docstring = extractDocstring(sourceFile, node);

    // 1. Imports
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const fileImport: FileImport = {
          source: moduleSpecifier.text,
          specifiers: []
        };

        const importClause = node.importClause;
        if (importClause) {
          if (importClause.name) {
            fileImport.isDefault = true;
            fileImport.defaultName = importClause.name.text;
          }
          if (importClause.namedBindings) {
            if (ts.isNamespaceImport(importClause.namedBindings)) {
              fileImport.isNamespace = true;
              fileImport.namespaceName = importClause.namedBindings.name.text;
            } else if (ts.isNamedImports(importClause.namedBindings)) {
              for (const element of importClause.namedBindings.elements) {
                fileImport.specifiers.push({
                  name: element.propertyName ? element.propertyName.text : element.name.text,
                  alias: element.propertyName ? element.name.text : undefined
                });
              }
            }
          }
        }
        imports.push(fileImport);
      }
      return;
    }

    // 2. Export Declaration (export { a, b as c } from '...')
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push(element.name.text);
        }
      }
      return;
    }

    // 3. Function Declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExported) exports.push(name);

      const modifiers = node.modifiers ? node.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
      const typeParams = node.typeParameters ? `<${node.typeParameters.map(p => p.getText(sourceFile)).join(", ")}>` : "";
      const params = node.parameters.map(p => p.getText(sourceFile)).join(", ");
      const returnType = node.type ? `: ${node.type.getText(sourceFile)}` : "";
      const signature = `${modifiers}function ${name}${typeParams}(${params})${returnType}`.trim();

      const outgoingRefs = collectOutgoingRefs(node, name);

      symbols.push({
        id: `${cleanPath}#${name}`,
        name,
        filePath: cleanPath,
        kind: "function",
        signature,
        line,
        docstring,
        outgoingRefs,
        incomingRefs: new Set<string>()
      });
      return;
    }

    // 4. Class Declarations
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExported) exports.push(className);

      const modifiers = node.modifiers ? node.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
      const typeParams = node.typeParameters ? `<${node.typeParameters.map(p => p.getText(sourceFile)).join(", ")}>` : "";
      const heritage = node.heritageClauses ? " " + node.heritageClauses.map(h => h.getText(sourceFile).replace(/\s+/g, " ")).join(" ") : "";
      const signature = `${modifiers}class ${className}${typeParams}${heritage}`.trim();

      const outgoingRefs = collectOutgoingRefs(node, className);

      symbols.push({
        id: `${cleanPath}#${className}`,
        name: className,
        filePath: cleanPath,
        kind: "class",
        signature,
        line,
        docstring,
        outgoingRefs,
        incomingRefs: new Set<string>()
      });

      // Extract class methods and member definitions
      for (const member of node.members) {
        const methodInfo = formatMethodSignature(sourceFile, member);
        if (methodInfo) {
          const methodLine = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1;
          const methodDoc = extractDocstring(sourceFile, member);
          const memberRefs = collectOutgoingRefs(member, methodInfo.name);

          symbols.push({
            id: `${cleanPath}#${className}.${methodInfo.name}`,
            name: `${className}.${methodInfo.name}`,
            filePath: cleanPath,
            kind: "method",
            signature: methodInfo.signature,
            line: methodLine,
            docstring: methodDoc,
            outgoingRefs: memberRefs,
            incomingRefs: new Set<string>()
          });
        }
      }
      return;
    }

    // 5. Interface Declarations
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExported) exports.push(name);

      const modifiers = node.modifiers ? node.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
      const typeParams = node.typeParameters ? `<${node.typeParameters.map(p => p.getText(sourceFile)).join(", ")}>` : "";
      const heritage = node.heritageClauses ? " " + node.heritageClauses.map(h => h.getText(sourceFile).replace(/\s+/g, " ")).join(" ") : "";
      const membersText = formatInterfaceMembers(sourceFile, node.members);
      const signature = `${modifiers}interface ${name}${typeParams}${heritage} ${membersText}`.trim();

      const outgoingRefs = collectOutgoingRefs(node, name);

      symbols.push({
        id: `${cleanPath}#${name}`,
        name,
        filePath: cleanPath,
        kind: "interface",
        signature,
        line,
        docstring,
        outgoingRefs,
        incomingRefs: new Set<string>()
      });
      return;
    }

    // 6. Type Alias Declarations
    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.text;
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExported) exports.push(name);

      const modifiers = node.modifiers ? node.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
      const typeParams = node.typeParameters ? `<${node.typeParameters.map(p => p.getText(sourceFile)).join(", ")}>` : "";
      const typeValue = node.type.getText(sourceFile).replace(/\r?\n\s*/g, " ");
      const signature = `${modifiers}type ${name}${typeParams} = ${typeValue}`.trim();

      const outgoingRefs = collectOutgoingRefs(node, name);

      symbols.push({
        id: `${cleanPath}#${name}`,
        name,
        filePath: cleanPath,
        kind: "type",
        signature,
        line,
        docstring,
        outgoingRefs,
        incomingRefs: new Set<string>()
      });
      return;
    }

    // 7. Enum Declarations
    if (ts.isEnumDeclaration(node)) {
      const name = node.name.text;
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExported) exports.push(name);

      const modifiers = node.modifiers ? node.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
      const members = node.members.map(m => m.name.getText(sourceFile)).join(", ");
      const signature = `${modifiers}enum ${name} { ${members} }`.trim();

      symbols.push({
        id: `${cleanPath}#${name}`,
        name,
        filePath: cleanPath,
        kind: "type",
        signature,
        line,
        docstring,
        outgoingRefs: new Set<string>(),
        incomingRefs: new Set<string>()
      });
      return;
    }

    // 8. Variable Statements (Arrow functions, consts, exports)
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      const modifiers = node.modifiers ? node.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";

      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        if (isExported) exports.push(name);

        const declLine = sourceFile.getLineAndCharacterOfPosition(decl.getStart(sourceFile)).line + 1;
        const declDoc = extractDocstring(sourceFile, node);

        // Arrow function or function expression
        if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
          const fn = decl.initializer;
          const isAsync = fn.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ? "async " : "";
          const typeParams = fn.typeParameters ? `<${fn.typeParameters.map(p => p.getText(sourceFile)).join(", ")}>` : "";
          const params = fn.parameters.map(p => p.getText(sourceFile)).join(", ");
          const returnType = fn.type ? `: ${fn.type.getText(sourceFile)}` : "";
          const signature = `${modifiers}const ${name} = ${isAsync}${typeParams}(${params})${returnType} => { ... }`.trim();

          const outgoingRefs = collectOutgoingRefs(fn, name);

          symbols.push({
            id: `${cleanPath}#${name}`,
            name,
            filePath: cleanPath,
            kind: "function",
            signature,
            line: declLine,
            docstring: declDoc,
            outgoingRefs,
            incomingRefs: new Set<string>()
          });
        } else if (isExported) {
          // Exported variable / constant
          const typeAnnotation = decl.type ? `: ${decl.type.getText(sourceFile)}` : "";
          const signature = `${modifiers}const ${name}${typeAnnotation}`.trim();
          const outgoingRefs = decl.initializer ? collectOutgoingRefs(decl.initializer, name) : new Set<string>();

          symbols.push({
            id: `${cleanPath}#${name}`,
            name,
            filePath: cleanPath,
            kind: "variable",
            signature,
            line: declLine,
            docstring: declDoc,
            outgoingRefs,
            incomingRefs: new Set<string>()
          });
        }
      }
      return;
    }

    // Recurse for nested blocks, but not inside function/class implementations (already handled)
    node.forEachChild(visit);
  }

  sourceFile.forEachChild(visit);

  return {
    filePath: cleanPath,
    symbols,
    imports,
    exports
  };
}
