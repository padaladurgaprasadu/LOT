/**
 * Pure TypeScript Python AST Parser & Tokenizer
 * Zero native or external binary dependencies.
 * Extracts functions, async functions, classes, methods, decorators,
 * type hints, docstrings, imports, and outgoing identifier references.
 */

import { AstSymbol, FileImport, FileParseResult, SymbolKind } from "./types";

const PYTHON_KEYWORD_SET = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "finally", "for", "from",
  "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield",
  "True", "False", "None", "self", "cls", "int", "str", "float", "bool",
  "list", "dict", "set", "tuple", "object", "type", "print", "len", "range"
]);

/**
 * Measure leading indentation spaces (treating tab as 4 spaces)
 */
function getIndentationLevel(line: string): number {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === " ") count += 1;
    else if (ch === "\t") count += 4;
    else break;
  }
  return count;
}

/**
 * Clean multi-line docstring text
 */
function cleanDocstring(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("@"));

  return lines.slice(0, 3).join(" ");
}

/**
 * Collect identifier references from code text
 */
function extractIdentifiersFromText(text: string, excludeName?: string): Set<string> {
  const refs = new Set<string>();
  const idRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
  let match: RegExpExecArray | null;

  while ((match = idRegex.exec(text)) !== null) {
    const id = match[0];
    if (
      id !== excludeName &&
      id.length > 1 &&
      !PYTHON_KEYWORD_SET.has(id) &&
      !/^[0-9]+$/.test(id)
    ) {
      refs.add(id);
    }
  }

  return refs;
}

/**
 * Check if the character at idx is escaped by an odd number of preceding backslashes.
 * e.g. in "C:\\" the quote at index 5 is preceded by 2 backslashes (even), so isEscaped is false.
 * In "C:\" the quote at index 4 is preceded by 1 backslash (odd), so isEscaped is true.
 */
function isEscaped(text: string, idx: number): boolean {
  let backslashCount = 0;
  for (let j = idx - 1; j >= 0 && text[j] === "\\"; j--) {
    backslashCount++;
  }
  return backslashCount % 2 === 1;
}

/**
 * Strip trailing inline comments (# ...) from a Python code line,
 * taking care not to strip '#' characters that appear inside single or double quotes.
 */
function stripTrailingComment(line: string): string {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let idx = 0; idx < line.length; idx++) {
    const ch = line[idx];

    if (ch === "'" && !inDoubleQuote && !isEscaped(line, idx)) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && !isEscaped(line, idx)) {
      inDoubleQuote = !inDoubleQuote;
    } else if (ch === "#" && !inSingleQuote && !inDoubleQuote) {
      return line.substring(0, idx);
    }
  }

  return line;
}

/**
 * Scan Python header text to find the terminating colon ':' of the definition.
 * Accurately skips colons inside parameter annotations, defaults, and quotes.
 * Returns -1 if the header is incomplete (e.g. multi-line header still open).
 */
function findHeaderColonIndex(text: string, startIndex: number = 0): number {
  let openParen = 0;
  let inParen = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let idx = startIndex; idx < text.length; idx++) {
    const ch = text[idx];

    if (ch === "'" && !inDoubleQuote && !isEscaped(text, idx)) {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && !isEscaped(text, idx)) {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === "(" || ch === "[" || ch === "{") {
        openParen++;
        inParen = true;
      } else if (ch === ")" || ch === "]" || ch === "}") {
        openParen--;
      } else if (ch === ":" && (!inParen || openParen <= 0)) {
        return idx;
      }
    }
  }

  return -1;
}

interface ClassScope {
  name: string;
  indent: number;
}

/**
 * Parse Python source code into AstSymbol array
 */
export function parsePythonAst(filePath: string, content: string): AstSymbol[] {
  const result = parsePythonFile(filePath, content);
  return result.symbols;
}

/**
 * Full file parse returning symbols, imports, and exports
 */
export function parsePythonFile(filePath: string, content: string): FileParseResult {
  const cleanPath = filePath.replace(/\\/g, "/");
  const rawLines = content.split(/\r?\n/);
  const symbols: AstSymbol[] = [];
  const imports: FileImport[] = [];
  const exports: string[] = [];

  let pendingDecorators: string[] = [];
  const classStack: ClassScope[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Skip empty lines or full comment lines (unless we have pending decorators)
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const currentIndent = getIndentationLevel(line);

    // Pop class stack if indentation dropped
    while (classStack.length > 0 && currentIndent <= classStack[classStack.length - 1].indent) {
      classStack.pop();
    }

    // 1. Imports
    // import foo, bar as b
    const importMatch = trimmed.match(/^import\s+(.+)$/);
    if (importMatch && !trimmed.startsWith("import (")) {
      const parts = importMatch[1].split(",");
      for (const part of parts) {
        const asParts = part.trim().split(/\s+as\s+/);
        const moduleName = asParts[0].trim();
        const alias = asParts[1]?.trim();
        imports.push({
          source: moduleName,
          specifiers: [{ name: moduleName, alias }]
        });
      }
      i++;
      continue;
    }

    // from module import a, b as c
    const fromMatch = trimmed.match(/^from\s+([a-zA-Z0-9_.]+)\s+import\s+(.+)$/);
    if (fromMatch) {
      const source = fromMatch[1];
      let importSpecStr = fromMatch[2].trim();

      // Handle multi-line import with parentheses: from x import (a, b)
      if (importSpecStr.startsWith("(")) {
        while (!importSpecStr.includes(")") && i + 1 < rawLines.length) {
          i++;
          importSpecStr += " " + rawLines[i].trim();
        }
        importSpecStr = importSpecStr.replace(/^\(/, "").replace(/\)$/, "").trim();
      }

      const fileImport: FileImport = {
        source,
        specifiers: []
      };

      const specifiers = importSpecStr.split(",");
      for (const spec of specifiers) {
        const specTrimmed = spec.trim();
        if (!specTrimmed) continue;
        if (specTrimmed === "*") {
          fileImport.isNamespace = true;
        } else {
          const asParts = specTrimmed.split(/\s+as\s+/);
          fileImport.specifiers.push({
            name: asParts[0].trim(),
            alias: asParts[1]?.trim()
          });
        }
      }
      imports.push(fileImport);
      i++;
      continue;
    }

    // 2. Decorators
    if (trimmed.startsWith("@")) {
      // Accumulate multi-line decorator if parentheses are open
      let decorator = stripTrailingComment(trimmed).trim();
      let openParen = (decorator.match(/\(/g) || []).length - (decorator.match(/\)/g) || []).length;
      while (openParen > 0 && i + 1 < rawLines.length) {
        i++;
        const nextLine = stripTrailingComment(rawLines[i]).trim();
        if (nextLine.length === 0) continue;
        decorator += " " + nextLine;
        openParen += (nextLine.match(/\(/g) || []).length - (nextLine.match(/\)/g) || []).length;
      }
      pendingDecorators.push(decorator);
      i++;
      continue;
    }

    // 3. Class Definitions
    if (/^class\s+/.test(trimmed)) {
      const classLine = i + 1;
      let rawClass = stripTrailingComment(trimmed).trim();

      // Handle multi-line class headers (accumulate until header colon is reached)
      let colonIdx = findHeaderColonIndex(rawClass);
      while (colonIdx === -1 && i + 1 < rawLines.length) {
        i++;
        const nextLineClean = stripTrailingComment(rawLines[i]).trim();
        if (nextLineClean.length === 0) continue;
        rawClass += " " + nextLineClean;
        colonIdx = findHeaderColonIndex(rawClass);
      }

      if (colonIdx !== -1) {
        const headerStr = rawClass.substring(0, colonIdx + 1).trim();
        const inlineClassBody = rawClass.substring(colonIdx + 1).trim();

        const classMatch = headerStr.match(/^class\s+([a-zA-Z0-9_]+)(?:\s*\(([\s\S]*?)\))?\s*:/);
        if (classMatch) {
          const className = classMatch[1];
          const inheritanceRaw = classMatch[2]?.trim() || "";

          // Extract bases
          const bases = inheritanceRaw
            ? inheritanceRaw.split(",").map(b => b.replace(/\s+/g, " ").trim()).filter(Boolean)
            : [];

          // Look ahead for docstring immediately following class header
          let docstring: string | undefined;
          if (inlineClassBody.startsWith('"""') || inlineClassBody.startsWith("'''")) {
            const quote = inlineClassBody.startsWith('"""') ? '"""' : "'''";
            if (inlineClassBody.length > 3 && inlineClassBody.indexOf(quote, 3) !== -1) {
              const closeIdx = inlineClassBody.indexOf(quote, 3);
              docstring = cleanDocstring(inlineClassBody.slice(3, closeIdx));
            }
          }

          if (!docstring) {
            let nextLineIndex = i + 1;
            while (nextLineIndex < rawLines.length && rawLines[nextLineIndex].trim().length === 0) {
              nextLineIndex++;
            }

            if (nextLineIndex < rawLines.length) {
              const docLine = rawLines[nextLineIndex].trim();
              if (docLine.startsWith('"""') || docLine.startsWith("'''")) {
                const quote = docLine.startsWith('"""') ? '"""' : "'''";
                if (docLine.length > 3 && docLine.endsWith(quote) && docLine.indexOf(quote, 3) !== -1) {
                  docstring = cleanDocstring(docLine.slice(3, -3));
                } else {
                  let docAccum = docLine.slice(3);
                  nextLineIndex++;
                  while (nextLineIndex < rawLines.length) {
                    const dl = rawLines[nextLineIndex];
                    if (dl.includes(quote)) {
                      docAccum += "\n" + dl.substring(0, dl.indexOf(quote));
                      break;
                    }
                    docAccum += "\n" + dl;
                    nextLineIndex++;
                  }
                  docstring = cleanDocstring(docAccum);
                }
              }
            }
          }

          // Collect outgoing refs from bases, decorators, and inline body
          const outgoingRefs = new Set<string>();
          for (const base of bases) {
            for (const id of extractIdentifiersFromText(base, className)) {
              outgoingRefs.add(id);
            }
          }
          for (const dec of pendingDecorators) {
            for (const id of extractIdentifiersFromText(dec, className)) {
              outgoingRefs.add(id);
            }
          }
          if (inlineClassBody) {
            for (const id of extractIdentifiersFromText(inlineClassBody, className)) {
              outgoingRefs.add(id);
            }
          }

          // Collect refs from entire class body
          let bodyIndex = i + 1;
          while (bodyIndex < rawLines.length) {
            const bline = rawLines[bodyIndex];
            const btrimmed = bline.trim();
            if (btrimmed.length > 0 && !btrimmed.startsWith("#")) {
              const bindent = getIndentationLevel(bline);
              if (bindent <= currentIndent) break;
              for (const id of extractIdentifiersFromText(btrimmed, className)) {
                outgoingRefs.add(id);
              }
            }
            bodyIndex++;
          }

          // Build signature
          const decPrefix = pendingDecorators.length > 0 ? pendingDecorators.join("\n") + "\n" : "";
          const baseStr = bases.length > 0 ? `(${bases.join(", ")})` : "";
          const signature = `${decPrefix}class ${className}${baseStr}:`.trim();

          symbols.push({
            id: `${cleanPath}#${className}`,
            name: className,
            filePath: cleanPath,
            kind: "class",
            signature,
            line: classLine,
            docstring,
            outgoingRefs,
            incomingRefs: new Set<string>()
          });

          // Class names are exported at module level if at indent 0
          if (currentIndent === 0) {
            exports.push(className);
          }

          classStack.push({ name: className, indent: currentIndent });
          pendingDecorators = [];
          i++;
          continue;
        }
      }

      pendingDecorators = [];
      i++;
      continue;
    }

    // 4. Function & Method Definitions (def / async def)
    if (/^(?:async\s+)?def\s+/.test(trimmed)) {
      const defLine = i + 1;
      let rawDef = stripTrailingComment(trimmed).trim();

      // Handle multi-line def headers (accumulate until header colon is reached)
      let colonIdx = findHeaderColonIndex(rawDef);
      while (colonIdx === -1 && i + 1 < rawLines.length) {
        i++;
        const nextLineClean = stripTrailingComment(rawLines[i]).trim();
        if (nextLineClean.length === 0) continue;
        rawDef += " " + nextLineClean;
        colonIdx = findHeaderColonIndex(rawDef);
      }

      if (colonIdx !== -1) {
        const headerStr = rawDef.substring(0, colonIdx + 1).trim();
        const inlineBody = rawDef.substring(colonIdx + 1).trim();

        const fnMatch = headerStr.match(/^(async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)(?:\s*->\s*([\s\S]*?))?:$/);
        if (fnMatch) {
          const isAsync = !!fnMatch[1];
          const fnName = fnMatch[2];
          const rawParams = fnMatch[3]?.trim() || "";
          const returnType = fnMatch[4]?.trim();

          // Determine if method inside class
          const currentClass = classStack.length > 0 ? classStack[classStack.length - 1] : null;
          const isMethod = currentClass !== null && currentIndent > currentClass.indent;
          const kind: SymbolKind = isMethod ? "method" : "function";
          const qualifiedName = isMethod ? `${currentClass.name}.${fnName}` : fnName;

          // Look ahead for docstring
          let docstring: string | undefined;
          if (inlineBody.startsWith('"""') || inlineBody.startsWith("'''")) {
            const quote = inlineBody.startsWith('"""') ? '"""' : "'''";
            if (inlineBody.length > 3 && inlineBody.indexOf(quote, 3) !== -1) {
              const closeIdx = inlineBody.indexOf(quote, 3);
              docstring = cleanDocstring(inlineBody.slice(3, closeIdx));
            }
          }

          if (!docstring) {
            let nextLineIndex = i + 1;
            while (nextLineIndex < rawLines.length && rawLines[nextLineIndex].trim().length === 0) {
              nextLineIndex++;
            }

            if (nextLineIndex < rawLines.length) {
              const docLine = rawLines[nextLineIndex].trim();
              if (docLine.startsWith('"""') || docLine.startsWith("'''")) {
                const quote = docLine.startsWith('"""') ? '"""' : "'''";
                if (docLine.length > 3 && docLine.endsWith(quote) && docLine.indexOf(quote, 3) !== -1) {
                  docstring = cleanDocstring(docLine.slice(3, -3));
                } else {
                  let docAccum = docLine.slice(3);
                  nextLineIndex++;
                  while (nextLineIndex < rawLines.length) {
                    const dl = rawLines[nextLineIndex];
                    if (dl.includes(quote)) {
                      docAccum += "\n" + dl.substring(0, dl.indexOf(quote));
                      break;
                    }
                    docAccum += "\n" + dl;
                    nextLineIndex++;
                  }
                  docstring = cleanDocstring(docAccum);
                }
              }
            }
          }

          // Collect outgoing references from params, return type, decorators, inline body, and function body
          const outgoingRefs = new Set<string>();
          for (const dec of pendingDecorators) {
            for (const id of extractIdentifiersFromText(dec, fnName)) {
              outgoingRefs.add(id);
            }
          }
          for (const id of extractIdentifiersFromText(rawParams, fnName)) {
            outgoingRefs.add(id);
          }
          if (returnType) {
            for (const id of extractIdentifiersFromText(returnType, fnName)) {
              outgoingRefs.add(id);
            }
          }
          if (inlineBody) {
            for (const id of extractIdentifiersFromText(inlineBody, fnName)) {
              outgoingRefs.add(id);
            }
          }

          // Collect refs from body
          let bodyIndex = i + 1;
          while (bodyIndex < rawLines.length) {
            const bline = rawLines[bodyIndex];
            const btrimmed = bline.trim();
            if (btrimmed.length > 0 && !btrimmed.startsWith("#")) {
              const bindent = getIndentationLevel(bline);
              if (bindent <= currentIndent) break;
              for (const id of extractIdentifiersFromText(btrimmed, fnName)) {
                outgoingRefs.add(id);
              }
            }
            bodyIndex++;
          }

          // Clean signature
          const decPrefix = pendingDecorators.length > 0 ? pendingDecorators.join("\n") + "\n" : "";
          const asyncPrefix = isAsync ? "async " : "";
          const retSuffix = returnType ? ` -> ${returnType}` : "";
          const cleanParams = rawParams.replace(/\s+/g, " ");
          const signature = `${decPrefix}${asyncPrefix}def ${fnName}(${cleanParams})${retSuffix}:`.trim();

          symbols.push({
            id: `${cleanPath}#${qualifiedName}`,
            name: qualifiedName,
            filePath: cleanPath,
            kind,
            signature,
            line: defLine,
            docstring,
            outgoingRefs,
            incomingRefs: new Set<string>()
          });

          if (currentIndent === 0 && !isMethod) {
            exports.push(fnName);
          }
        }
      }

      pendingDecorators = [];
      i++;
      continue;
    }

    // 5. Module-level variables / Constants (e.g. MAX_LIMIT: int = 100 or API_URL = "...")
    if (currentIndent === 0 && !trimmed.startsWith("def ") && !trimmed.startsWith("class ")) {
      const varMatch = trimmed.match(/^([A-Z][A-Z0-9_]*)(?:\s*:\s*([a-zA-Z0-9_\[\], ]+))?\s*=\s*(.+)$/);
      if (varMatch) {
        const varName = varMatch[1];
        const typeHint = varMatch[2]?.trim();
        const valueExpr = varMatch[3]?.trim();
        const varLine = i + 1;

        const outgoingRefs = extractIdentifiersFromText(valueExpr, varName);
        if (typeHint) {
          for (const id of extractIdentifiersFromText(typeHint, varName)) {
            outgoingRefs.add(id);
          }
        }

        const typeSuffix = typeHint ? `: ${typeHint}` : "";
        const signature = `${varName}${typeSuffix} = ...`;

        symbols.push({
          id: `${cleanPath}#${varName}`,
          name: varName,
          filePath: cleanPath,
          kind: "variable",
          signature,
          line: varLine,
          outgoingRefs,
          incomingRefs: new Set<string>()
        });
        exports.push(varName);
      }
    }

    // Reset pending decorators if we hit an unrecognized statement
    pendingDecorators = [];
    i++;
  }

  return {
    filePath: cleanPath,
    symbols,
    imports,
    exports
  };
}
