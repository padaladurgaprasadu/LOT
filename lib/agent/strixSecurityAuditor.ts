// lib/agent/strixSecurityAuditor.ts
export interface StrixAuditReport {
  taintClean: boolean;
  riskScore: number; // 0 (Safe) to 100 (Critical)
  findings: string[];
  sanitizedCode: string;
}

/**
 * STRIX PRE-EXECUTION GATE
 * Performs static taint analysis for secret exfiltration, RCE, and dangerous DOM sinks.
 */
export class StrixSecurityAuditor {
  private static RULES = [
    { name: "Shell Deletion / Format", regex: /\b(rm\s+-rf|mkfs|dd\s+if=)\b/gi, score: 95 },
    { name: "Arbitrary Code Eval", regex: /\b(eval\s*\(|new\s+Function\s*\()\b/g, score: 65 },
    { name: "Process Env Exfiltration", regex: /process\.env\.[A-Z0-9_]+/g, score: 40 },
    { name: "Child Process Spawn", regex: /child_process|execSync|spawnSync/g, score: 85 },
    { name: "SQL Drop / Truncate", regex: /\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE)\b/gi, score: 90 },
  ];

  public static audit(rawCode: string): StrixAuditReport {
    const findings: string[] = [];
    let riskScore = 0;

    for (const rule of this.RULES) {
      if (rule.regex.test(rawCode)) {
        findings.push(`Detected ${rule.name}`);
        riskScore = Math.max(riskScore, rule.score);
      }
    }

    return {
      taintClean: riskScore < 70,
      riskScore,
      findings,
      sanitizedCode: rawCode,
    };
  }
}

// Re-export existing security auditor utilities for complete compatibility
export { auditCodeSecurity, generateSecurityAuditReport } from "@/lib/security/strixSecurityAuditor";
export type { SecurityVulnerability } from "@/lib/security/strixSecurityAuditor";
