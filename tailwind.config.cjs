/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./public/js/**/*.js"],
  important: ".lux-site",
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        lux: {
          dark: "#2b2b2b",
          darker: "#1f1f1f",
          light: "#f5f5f5",
          card: "#ffffff",
          brown: "#8b5e3c",
          coral: "#d16a5a",
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"Montserrat"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        lux: "18px",
      },
      boxShadow: {
        "lux-card": "0 12px 40px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)",
        "lux-card-hover": "0 20px 50px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06)",
        "lux-nav": "0 8px 32px rgba(0, 0, 0, 0.18)",
      },
      backdropBlur: {
        nav: "24px",
      },
      transitionTimingFunction: {
        lux: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
