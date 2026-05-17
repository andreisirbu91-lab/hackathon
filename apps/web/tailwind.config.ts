import type { Config } from "tailwindcss";

// Inspired by hackaton.ambasada.pro:
// near-black background, coral/red accent for primary actions, mono-terminal vibe.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(0 0% 5%)",            // deep matte black
        panel: "hsl(0 0% 8%)",         // raised surface
        border: "hsl(0 0% 16%)",       // hairline
        text: "hsl(0 0% 96%)",         // off-white
        muted: "hsl(0 0% 60%)",        // dim
        accent: "hsl(350 90% 62%)",    // coral red — the "AI agents" red on the site
        "accent-soft": "hsl(350 90% 16%)",
        success: "hsl(142 60% 55%)",
        warn: "hsl(38 92% 55%)",
        danger: "hsl(0 84% 60%)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px hsl(0 0% 0% / 0.25), 0 4px 12px hsl(0 0% 0% / 0.18)",
        glow: "0 0 0 1px hsl(350 90% 62% / 0.35), 0 0 32px hsl(350 90% 62% / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
