/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}", "../implementation/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          pressed: "hsl(var(--brand-pressed))",
          tint: "hsl(var(--brand-tint))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          amber: "hsl(var(--accent-amber))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // The type scale: 24 / 20 / 16 / 14 / 12. Nothing below 12, no step wider than 4px.
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.4" }],
        sm: ["0.875rem", { lineHeight: "1.4" }],
        base: ["1rem", { lineHeight: "1.4" }],
        lg: ["1.25rem", { lineHeight: "1.3" }],
        xl: ["1.5rem", { lineHeight: "1.25" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius-input)",
        sm: "calc(var(--radius-input) - 2px)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
      },
      // The spacing tiers, decided once: 4 / 8 / 16 / 24 / 48.
      spacing: {
        1: "0.25rem",
        2: "0.5rem",
        4: "1rem",
        6: "1.5rem",
        12: "3rem",
      },
    },
  },
  plugins: [],
};
