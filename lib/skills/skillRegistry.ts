/**
 * LOT AI Plugin & Skill Registry Engine
 * Inspired by https://github.com/anthropics/skills, https://github.com/perplexityai/modelcontextprotocol,
 * and https://github.com/benjaminasterA/antigravity-awesome-skills
 */

import { AWESOME_SKILLS_CATALOG } from "./awesomeSkillsCatalog";

export interface SkillManifest {
  id: string;
  name: string;
  category: "coding" | "security" | "finance" | "legal" | "healthcare" | "productivity" | "design";
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  systemDirective: string;
  iconName: string;
}

export const DEFAULT_SKILLS: SkillManifest[] = [
  {
    id: "frontend-design",
    name: "Frontend Design (Anti-Slop)",
    category: "coding",
    version: "1.2.0",
    description: "Enforces human-crafted UI hierarchy, responsive Tailwind breakpoints, and eliminates generic AI slop.",
    author: "LOT AI Core",
    enabled: true,
    systemDirective: "Apply strict UI hierarchy, accessible contrast, semantic HTML, and responsive Tailwind styling.",
    iconName: "Layout",
  },
  {
    id: "strix-security",
    name: "Strix Security Auditor",
    category: "security",
    version: "2.0.1",
    description: "Automated vulnerability scanner for OWASP Top 10 issues (SQLi, XSS, SSRF, Hardcoded Secrets).",
    author: "Strix Open-Source",
    enabled: true,
    systemDirective: "Scan generated code for security vulnerabilities and provide instant remediation patches.",
    iconName: "ShieldAlert",
  },
  {
    id: "financial-services",
    name: "Financial Modeling & Analysis",
    category: "finance",
    version: "1.0.4",
    description: "Financial statement parsing, DCF valuation, EBITDA margin modeling, and SEC 10-K analysis.",
    author: "LOT Enterprise",
    enabled: true,
    systemDirective: "Analyze financial data with rigorous accounting standards, valuation matrices, and ratio breakdowns.",
    iconName: "TrendingUp",
  },
  {
    id: "claude-for-legal",
    name: "Legal Contract Redlining",
    category: "legal",
    version: "1.1.0",
    description: "Automated clause extraction, NDA risk auditing, indemnification redlining, and compliance checks.",
    author: "LOT Enterprise",
    enabled: true,
    systemDirective: "Audit legal documents with contract law standards, highlighting liabilities and indemnification risks.",
    iconName: "Scale",
  },
  {
    id: "healthcare-clinical",
    name: "Clinical Document Structuring",
    category: "healthcare",
    version: "1.0.0",
    description: "Structures clinical SOAP notes, medical terminology categorization, and biomedical summaries.",
    author: "LOT Enterprise",
    enabled: true,
    systemDirective: "Structure health and clinical information following standard medical documentation frameworks.",
    iconName: "Activity",
  },
  {
    id: "stitch-tokens",
    name: "Stitch UI Token Contract",
    category: "coding",
    version: "1.0.2",
    description: "Generates DESIGN.md token contracts to guarantee zero visual drift across application pages.",
    author: "Google Labs",
    enabled: true,
    systemDirective: "Generate and adhere strictly to DESIGN.md token contracts for consistent design systems.",
    iconName: "Palette",
  },
  ...AWESOME_SKILLS_CATALOG,
];

export class SkillRegistryManager {
  private skills: Map<string, SkillManifest> = new Map();

  constructor() {
    DEFAULT_SKILLS.forEach((s) => this.skills.set(s.id, s));
  }

  public listSkills(): SkillManifest[] {
    return Array.from(this.skills.values());
  }

  public toggleSkill(id: string, enabled: boolean): boolean {
    const skill = this.skills.get(id);
    if (skill) {
      skill.enabled = enabled;
      return true;
    }
    return false;
  }

  public getActiveDirectives(): string {
    const active = Array.from(this.skills.values()).filter((s) => s.enabled);
    if (active.length === 0) return "";
    return active.map((s) => `[SKILL: ${s.name.toUpperCase()}]: ${s.systemDirective}`).join("\n");
  }
}

export const globalSkillRegistry = new SkillRegistryManager();
