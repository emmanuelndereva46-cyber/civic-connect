/** @type {import('tailwindcss').Config} */
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        civic: {
          navy: c("--c-navy"),
          blue: c("--c-blue"),
          teal: c("--c-teal"),
          amber: c("--c-amber"),
          bg: c("--c-bg"),
          ink: c("--c-ink"),
          line: c("--c-line"),
        },
      },
      fontFamily: {
        sans: ["'Public Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-up": { "0%": { opacity: 0, transform: "translateY(18px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "fade-in": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        "float-y": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        "drift-a": { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(60px,40px) scale(1.12)" } },
        "drift-b": { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(-70px,-30px) scale(1.18)" } },
        "gradient-x": { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        "dash": { to: { strokeDashoffset: -200 } },
        "pulse-ring": { "0%": { transform: "scale(.8)", opacity: 0.7 }, "100%": { transform: "scale(2.2)", opacity: 0 } },
      },
      animation: {
        "fade-up": "fade-up .7s cubic-bezier(.22,1,.36,1) both",
        "fade-in": "fade-in .5s ease both",
        "float-y": "float-y 6s ease-in-out infinite",
        "drift-a": "drift-a 22s ease-in-out infinite",
        "drift-b": "drift-b 28s ease-in-out infinite",
        "gradient-x": "gradient-x 8s ease infinite",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
