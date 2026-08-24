import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        surface: {
          50: "#18181b",
          100: "#141416",
          200: "#0f0f11",
          300: "#09090b",
          DEFAULT: "#121214",
        },
        border: {
          subtle: "#1f1f23",
          DEFAULT: "#27272a",
          highlight: "#3f3f46",
        },
        accent: {
          cyan: "#38bdf8",
          purple: "#a855f7",
          blue: "#3b82f6",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
