import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#050505",
          subtle: "#0c0c0c",
          panel: "#111111",
          elevated: "#161616",
          border: "#1f1f1f",
        },
        text: {
          DEFAULT: "#fafafa",
          muted: "#8a8a8a",
          dim: "#555555",
        },
        accent: {
          DEFAULT: "#ffffff",
          gold: "#e8a121",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { lg: "12px", md: "8px", sm: "6px" },
    },
  },
  plugins: [],
} satisfies Config;
