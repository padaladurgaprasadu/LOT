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

/**
 * Skill enablement is PER USER.
 *
 * The registry previously held one shared manifest list and toggleSkill() mutated it in
 * place, so any signed-in user turning a skill off turned it off for every other user of
 * the same server process — and the change silently reverted on the next deploy.
 * Defaults stay immutable; each user gets an overlay of their own overrides.
 */
export class SkillRegistryManager {
  private readonly defaults: Map<string, SkillManifest> = new Map();
  private readonly userOverrides: Map<string, Map<string, boolean>> = new Map();

  constructor() {
    DEFAULT_SKILLS.forEach((s) => this.defaults.set(s.id, { ...s }));
  }

  public listSkills(userId?: string): SkillManifest[] {
    const overrides = userId ? this.userOverrides.get(userId) : undefined;
    return Array.from(this.defaults.values()).map((skill) => {
      const override = overrides?.get(skill.id);
      return override === undefined ? { ...skill } : { ...skill, enabled: override };
    });
  }

  public toggleSkill(id: string, enabled: boolean, userId?: string): boolean {
    if (!this.defaults.has(id)) return false;
    if (!userId) return false;

    let overrides = this.userOverrides.get(userId);
    if (!overrides) {
      overrides = new Map();
      this.userOverrides.set(userId, overrides);
    }
    overrides.set(id, enabled);
    return true;
  }

  public getActiveDirectives(userId?: string): string {
    const active = this.listSkills(userId).filter((s) => s.enabled);
    if (active.length === 0) return "";
    return active.map((s) => `[SKILL: ${s.name.toUpperCase()}]: ${s.systemDirective}`).join("\n");
  }
}

export const globalSkillRegistry = new SkillRegistryManager();
