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
        // --- 1. SHADCN COMPATIBILITY (Restored) ---
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))", // Reads 221 100% 23% from globals.css
          foreground: "hsl(var(--primary-foreground))",
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
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        
        // --- 2. YOUR CUSTOM COLORS (Mapped to CSS Variables) ---
        card: {
          // Keep default Shadcn card background
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;