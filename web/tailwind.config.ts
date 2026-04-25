import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#000000",
          subtle: "#0a0a0a",
          panel: "#0f0f0f",
          border: "#1a1a1a",
        },
        text: {
          DEFAULT: "#fafafa",
          muted: "#737373",
          dim: "#404040",
        },
        accent: {
          DEFAULT: "#ffffff",
          gold: "#e8a121",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { lg: "12px", md: "8px", sm: "6px" },
    },
  },
  plugins: [],
} satisfies Config;
