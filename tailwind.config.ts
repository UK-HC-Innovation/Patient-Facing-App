import type { Config } from "tailwindcss";

// Semantic colors resolve through CSS variables so one surface can wear a
// different palette without a second set of utility names. The values live in
// src/styles/palette.ts and are written onto :root and .theme-ladder by
// globals.css; `<alpha-value>` keeps every existing bg-care/5 and border-care/40
// working unchanged.
const semantic = (token: string) => `rgb(var(--color-${token}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: semantic("ink"),
        paper: semantic("paper"),
        care: semantic("care"),
        pulse: semantic("pulse"),
        calm: semantic("calm"),
        note: semantic("note")
      },
      borderRadius: {
        control: "8px"
      }
    }
  },
  plugins: []
};

export default config;
