/** Дизайн-система Better study: обсидиан, аврора фиолетовый/изумруд, стекло. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#050505",
        violet: { DEFAULT: "#7C3AED", soft: "#A78BFA" },
        emerald: { DEFAULT: "#10B981", soft: "#6EE7B7" },
        mist: "#A1A1AA",
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"Inter Variable"', "system-ui", "sans-serif"],
      },
      letterSpacing: { tightest: "-0.02em" },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        // Цветные тени вместо чёрных: огромный blur с цветом акцента
        "glow-violet": "0 20px 80px -20px rgba(124,58,237,.55)",
        "glow-emerald": "0 20px 80px -20px rgba(16,185,129,.45)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
      },
      animation: { float: "float 3.2s ease-in-out infinite" },
    },
  },
  plugins: [],
};
