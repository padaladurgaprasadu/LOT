/**
 * LOT Code Operational Modes
 * Inspired by Claude Code & OpenCode architecture
 */

export type LotAgentMode = "plan" | "act" | "audit" | "auto";

export interface AgentModeConfig {
  mode: LotAgentMode;
  name: string;
  description: string;
  allowFileWrite: boolean;
  allowCommandExecution: boolean;
  enforceSecurityReview: boolean;
}

export const LOT_MODES: Record<LotAgentMode, AgentModeConfig> = {
  plan: {
    mode: "plan",
    name: "Architectural Planning Mode",
    description: "Read-only exploration, AST inspection, and system architecture planning. Zero disk writes without user confirmation.",
    allowFileWrite: false,
    allowCommandExecution: false,
    enforceSecurityReview: false,
  },
  act: {
    mode: "act",
    name: "Autonomous Action Mode",
    description: "Active development mode with file editing, diff synthesis, and test runner execution.",
    allowFileWrite: true,
    allowCommandExecution: true,
    enforceSecurityReview: true,
  },
  audit: {
    mode: "audit",
    name: "Strix Security Audit Mode",
    description: "Offensive & defensive security auditing, vulnerability discovery (OWASP Top 10), and automated PR remediation.",
    allowFileWrite: false,
    allowCommandExecution: false,
    enforceSecurityReview: true,
  },
  auto: {
    mode: "auto",
    name: "Unattended CI/CD Mode",
    description: "Fully automated pipeline for GitHub Actions, unattended PR resolution, and scheduled refactoring.",
    allowFileWrite: true,
    allowCommandExecution: true,
    enforceSecurityReview: true,
  },
};
