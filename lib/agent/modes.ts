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
    name: "Build Mode",
    description: "The agent reads the workspace, writes real diffs, and shows each change for one-click approval before it lands.",
    allowFileWrite: true,
    allowCommandExecution: false,
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
    name: "Auto-Apply Mode",
    description: "The agent applies its own changes to the workspace as it goes; you review the finished result.",
    allowFileWrite: true,
    allowCommandExecution: false,
    enforceSecurityReview: true,
  },
};
