/** Дизайн-система Better: светлая, тёплая, «жидкое стекло». Study — синий, Teach — коралловый. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF7F2",
        // Цвет текущего продукта: BetterStudy (синий) или BetterTeach (коралловый) — через data-brand на <html>
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          deep: "rgb(var(--brand-deep) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          tint: "rgb(var(--brand-tint) / <alpha-value>)",
        },
        ink: { DEFAULT: "#1E2235", soft: "#4B5068", mute: "#7A7F96" },
        line: "#E9E4DC",
        study: { DEFAULT: "#3D63F5", deep: "#2A47C9", soft: "#E3E9FF", tint: "#F1F4FF" },
        teach: { DEFAULT: "#F2643D", deep: "#D44A24", soft: "#FFE4DA", tint: "#FFF4EF" },
        sun: { DEFAULT: "#FFC24B", soft: "#FFF1CF" },
        mint: { DEFAULT: "#22B07D", soft: "#DDF5EB" },
        lilac: { DEFAULT: "#8B7CF6", soft: "#ECE9FF" },
      },
      fontFamily: {
        display: ['"Manrope Variable"', "system-ui", "sans-serif"],
        sans: ['"Inter Variable"', "system-ui", "sans-serif"],
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(30,34,53,.04), 0 8px 24px -12px rgba(30,34,53,.14)",
        lift: "0 2px 6px rgba(30,34,53,.05), 0 22px 48px -22px rgba(30,34,53,.28)",
        "study-glow": "0 14px 34px -14px rgba(61,99,245,.55)",
        "teach-glow": "0 14px 34px -14px rgba(242,100,61,.55)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        fadeup: { from: { opacity: 0, transform: "translateY(14px)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        marquee: "marquee 50s linear infinite",
        fadeup: "fadeup .5s cubic-bezier(.22,1,.36,1) both",
      },
    },
  },
  plugins: [],
};
