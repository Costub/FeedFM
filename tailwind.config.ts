import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        amber: "#ffb84d",
        coral: "#ff5f7e",
        "signal-green": "#77ff79",
        "pixel-cream": "#fff2cf",
        "console-black": "#10100e",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        pixel: "6px 6px 0 #050505",
        "pixel-sm": "3px 3px 0 #050505",
        glow: "0 0 22px rgba(119, 255, 121, 0.24)",
      },
      fontFamily: {
        pixel: ["var(--font-pixel)", "monospace"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      keyframes: {
        blink: {
          "0%, 48%": { opacity: "1" },
          "49%, 100%": { opacity: "0.42" },
        },
        scan: {
          "0%": { transform: "translateY(-8px)" },
          "100%": { transform: "translateY(8px)" },
        },
        equalize: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        floatNeedle: {
          "0%, 100%": { transform: "translateX(-8%)" },
          "50%": { transform: "translateX(10%)" },
        },
      },
      animation: {
        blink: "blink 1.05s steps(2, end) infinite",
        scan: "scan 1.8s linear infinite alternate",
        equalize: "equalize 1s ease-in-out infinite",
        "float-needle": "floatNeedle 5.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
