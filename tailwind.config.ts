import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Velvet Ledger — surface hierarchy (full + short aliases)
        surface: "#131313",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353534",
        "surface-lowest": "#0e0e0e",
        "surface-low": "#1c1b1b",
        "surface-high": "#2a2a2a",
        "surface-highest": "#353534",
        "surface-variant": "#353534",
        // Text
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#bbcabf",
        outline: "#86948a",
        "outline-variant": "#3c4a42",
        // Semantic accents
        primary: {
          DEFAULT: "#4edea3",
          container: "#10b981",
        },
        secondary: {
          DEFAULT: "#adc6ff",
          container: "#0566d9",
        },
        tertiary: {
          DEFAULT: "#ffb3ad",
          container: "#ff7a73",
        },
        error: {
          DEFAULT: "#ffb4ab",
          container: "#93000a",
        },
        // shadcn/ui CSS-variable aliases
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      fontFamily: {
        manrope: ["var(--font-manrope)", "sans-serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      backgroundImage: {
        "signature-gradient": "linear-gradient(135deg, #4edea3, #10b981)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
