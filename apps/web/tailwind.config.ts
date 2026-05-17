import type { Config } from "tailwindcss";

// Light, friendly palette, brand red kept for accents.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(40 30% 99%)",          // warm near-white
        panel: "hsl(40 18% 96%)",       // raised surface
        border: "hsl(40 10% 88%)",      // hairline
        text: "hsl(222 14% 14%)",       // near-black
        muted: "hsl(222 8% 45%)",       // medium gray
        accent: "hsl(350 85% 52%)",     // brand coral red
        "accent-soft": "hsl(350 85% 96%)",
        success: "hsl(142 50% 38%)",
        warn: "hsl(35 90% 45%)",
        danger: "hsl(0 75% 50%)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px hsl(220 30% 12% / 0.04), 0 4px 12px hsl(220 30% 12% / 0.05)",
        glow: "0 0 0 1px hsl(350 85% 52% / 0.18), 0 0 24px hsl(350 85% 52% / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
