import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(222 47% 6%)",
        panel: "hsl(222 47% 9%)",
        border: "hsl(222 30% 18%)",
        text: "hsl(210 40% 96%)",
        muted: "hsl(215 20% 65%)",
        accent: "hsl(199 89% 48%)",
        success: "hsl(142 71% 45%)",
        warn: "hsl(38 92% 50%)",
        danger: "hsl(0 84% 60%)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
