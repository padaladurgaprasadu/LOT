/**
 * Google Labs Stitch Skills Engine
 * Inspired by https://github.com/google-labs-code/stitch-skills
 * Provides token contract generation (DESIGN.md), UI component synthesis, and autonomous stitch loops.
 */

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    border: string;
  };
  typography: {
    fontFamily: string;
    headingFont: string;
    scale: Record<string, string>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
}

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  colors: {
    primary: "#3B82F6",
    secondary: "#10B981",
    background: "#09090B",
    surface: "#18181B",
    text: "#F4F4F5",
    border: "#27272A",
  },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    headingFont: "Plus Jakarta Sans, sans-serif",
    scale: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
    },
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  borderRadius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  },
};

export function generateDesignMd(tokens: DesignTokens = DEFAULT_DESIGN_TOKENS): string {
  return `# DESIGN.md - Design Token Contract (Stitch Standard)

## 1. Color Palette
- **Primary Accent**: \`${tokens.colors.primary}\`
- **Secondary Accent**: \`${tokens.colors.secondary}\`
- **Background Layer**: \`${tokens.colors.background}\`
- **Surface / Card Layer**: \`${tokens.colors.surface}\`
- **Primary Text**: \`${tokens.colors.text}\`
- **Border / Divider**: \`${tokens.colors.border}\`

## 2. Typography
- **Body Font**: \`${tokens.typography.fontFamily}\`
- **Heading Font**: \`${tokens.typography.headingFont}\`

## 3. Spatial System
- **Base Unit**: 4px
- **Padding Scale**: \`xs: 4px | sm: 8px | md: 16px | lg: 24px | xl: 32px\`
- **Border Radius**: \`sm: 6px | md: 10px | lg: 16px | full: 9999px\`

## 4. Component Rules
- Always use semantic dark surface cards with subtle border contrasts (\`${tokens.colors.border}\`).
- Avoid unconstrained gradients; keep accent colors targeted to primary interactive CTAs.
`;
}
