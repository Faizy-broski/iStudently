import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
 
  theme: {
    extend: {
      colors: {
        // --- 1. SHADCN COMPATIBILITY ---
        // CSS vars are oklch() — use var() directly, NOT hsl(var())
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        
        // --- 2. YOUR CUSTOM COLORS (Mapped to CSS Variables) ---
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
          
          // Add your custom variants
          blue: "var(--card-blue)",
          green: "var(--card-green)",
          teal: "var(--card-teal)",
          orange: "var(--card-orange)",
          red: "var(--card-red)",
        },
        
        // Custom Sidebar Gradient Start/End 
        sidebar: {
            start: "var(--sidebar-start)",
            end: "var(--sidebar-end)",
        }
      },
      backgroundImage: {
        "sidebar-gradient": "linear-gradient(90deg, var(--sidebar-start) 0%, var(--sidebar-end) 100%)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-cairo)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;