/**
 * Claude Code Frontend Design Standard Skill
 * Inspired by https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
 * Eliminates generic AI slop and enforces human-crafted tier UI/UX standards.
 */

export const FRONTEND_DESIGN_GUIDELINES = `
## FRONTEND DESIGN STANDARDS (Anti-AI Slop Directive):
1. TYPOGRAPHY & CONTRAST:
   - Avoid generic, overused font stacks without hierarchy.
   - Use high-contrast headers with purposeful tracking and line-height.
   - Never use low-contrast grey-on-dark-grey text.

2. AVOID "AI SLOP" TROPES:
   - Do NOT default to generic purple radial gradients on every card.
   - Do NOT use meaningless glowing orbs or floating placeholder badges without purpose.
   - Favor clean, geometric structure, subtle borders (border-white/10), and purposeful whitespace.

3. COMPONENT INTEGRITY:
   - Use semantic HTML (<header>, <main>, <section>, <article>, <nav>).
   - Write fully typed TypeScript interfaces for all component props.
   - Ensure complete responsive breakpoint support (sm:, md:, lg:, xl:).
   - Include interactive micro-states (hover:, active:, focus-visible:).
`;

export function injectFrontendDesignContext(prompt: string): string {
  return `${prompt}\n\n[FRONTEND DESIGN DIRECTIVE APPLIED]:\n${FRONTEND_DESIGN_GUIDELINES}`;
}
