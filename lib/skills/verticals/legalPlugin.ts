/**
 * Legal Contract & Compliance Vertical Plugin
 * Inspired by https://github.com/anthropics/claude-for-legal
 */

export interface LegalClauseRisk {
  clause: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  redlineSuggestion: string;
}

export function auditLegalContract(text: string): LegalClauseRisk[] {
  const risks: LegalClauseRisk[] = [];

  if (/\b(indemnify|hold harmless|unlimited liability)\b/i.test(text)) {
    risks.push({
      clause: "Indemnification & Liability",
      riskLevel: "HIGH",
      explanation: "Uncapped indemnification clause poses material financial exposure.",
      redlineSuggestion: "Cap aggregate indemnification liability to the total contract value paid in the preceding 12 months.",
    });
  }

  if (/\b(auto-renew|automatic renewal|without notice)\b/i.test(text)) {
    risks.push({
      clause: "Automatic Renewal",
      riskLevel: "MEDIUM",
      explanation: "Auto-renewal without minimum 30-day written notice creates vendor lock-in risk.",
      redlineSuggestion: "Require mandatory written notice at least 45 days prior to renewal date.",
    });
  }

  return risks;
}
