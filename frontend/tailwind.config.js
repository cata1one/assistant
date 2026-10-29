/**
 * Дизайн-система Bright: бумага, чернила и один тёплый акцент (жёлтый).
 * Цвет роли (коралловый у преподавателя, синий у ученика) – только в мелочах: активный пункт меню, ссылки, отметки.
 */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F4F3EF",
        paper: "#FAFAF8",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          tint: "rgb(var(--brand-tint) / <alpha-value>)",
        },
        ink: { DEFAULT: "#17171A", soft: "#4A4A52", mute: "#85858D" },
        line: "#E7E5DF",
        study: { DEFAULT: "#2B59E8", deep: "#1E44C0", soft: "#E2E9FD", tint: "#F3F6FE" },
        teach: { DEFAULT: "#E4572E", deep: "#C2421D", soft: "#FCE6DE", tint: "#FEF4F0" },
        sun: { DEFAULT: "#FFD43B", soft: "#FFF4C7" },
        mint: { DEFAULT: "#1F9D63", soft: "#E3F4EA" },
        lilac: { DEFAULT: "#6E5BD8", soft: "#EEEBFB" },
      },
      fontFamily: {
        display: ['"Onest Variable"', "system-ui", "sans-serif"],
        sans: ['"Onest Variable"', "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "10px", "2xl": "12px", "3xl": "16px", "4xl": "20px" },
      boxShadow: {
        soft: "0 1px 2px rgba(23,23,26,.05)",
        lift: "0 2px 6px rgba(23,23,26,.06), 0 16px 40px -16px rgba(23,23,26,.28)",
        "study-glow": "0 1px 2px rgba(23,23,26,.05)",
        "teach-glow": "0 1px 2px rgba(23,23,26,.05)",
      },
      keyframes: {
        fadeup: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
        pulse2: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.35 } },
      },
      animation: {
        fadeup: "fadeup .35s cubic-bezier(.22,1,.36,1) both",
        float: "none",
        marquee: "none",
      },
    },
  },
  plugins: [],
};
