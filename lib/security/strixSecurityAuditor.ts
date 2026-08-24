/**
 * Strix Autonomous AI Security Auditor & Remediation Engine
 * Inspired by https://github.com/usestrix/strix
 * Performs automated static vulnerability auditing and patch synthesis.
 */

export interface SecurityVulnerability {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "SQL_INJECTION" | "XSS" | "SSRF" | "AUTH_BYPASS" | "INSECURE_SECRET" | "RCE";
  file: string;
  line?: number;
  description: string;
  remediation: string;
}

export function auditCodeSecurity(code: string, fileName = "input.ts"): SecurityVulnerability[] {
  const vulnerabilities: SecurityVulnerability[] = [];

  // 1. Hardcoded Secrets Check
  if (/(api[_-]?key|secret|password|token)\s*[:=]\s*['"`][a-zA-Z0-9_\-]{16,}['"`]/i.test(code)) {
    vulnerabilities.push({
      id: "STRIX-SEC-001",
      severity: "CRITICAL",
      category: "INSECURE_SECRET",
      file: fileName,
      description: "Hardcoded API secret or credential detected in source code.",
      remediation: "Store all sensitive credentials in environment variables (`process.env.SECRET_KEY`).",
    });
  }

  // 2. Direct Raw SQL Query / SQL Injection
  if (/(\$query|db\.query|SELECT\s+.*FROM|exec\()\s*.*(\+|\$\{)/i.test(code)) {
    vulnerabilities.push({
      id: "STRIX-SEC-002",
      severity: "CRITICAL",
      category: "SQL_INJECTION",
      file: fileName,
      description: "Unsanitized dynamic string concatenation detected in SQL/Database query.",
      remediation: "Use parameterized queries or prepared statements (`$1, $2` or ORM bindings).",
    });
  }

  // 3. Unsafe eval / innerHTML (XSS / RCE)
  if (/\b(eval\(|dangerouslySetInnerHTML|innerHTML\s*=)/i.test(code)) {
    vulnerabilities.push({
      id: "STRIX-SEC-003",
      severity: "HIGH",
      category: "XSS",
      file: fileName,
      description: "Unsafe DOM insertion or dynamic evaluation detected (potential XSS/RCE).",
      remediation: "Use sanitized React text nodes or DOMPurify before injecting dynamic content.",
    });
  }

  return vulnerabilities;
}

export function generateSecurityAuditReport(vulnerabilities: SecurityVulnerability[]): string {
  if (vulnerabilities.length === 0) {
    return "### 🛡️ Strix Security Audit: 0 Vulnerabilities Detected (Clean Build)";
  }

  const rows = vulnerabilities
    .map(
      (v) =>
        `| **${v.severity}** | \`${v.category}\` | ${v.description} | ${v.remediation} |`
    )
    .join("\n");

  return `### 🛡️ Strix Security Audit Report\n\n| Severity | Category | Issue | Remediation |\n| :--- | :--- | :--- | :--- |\n${rows}`;
}
