/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gear: {
          bg: "#f8fafd",
          surface: "#ffffff",
          "surface-soft": "#f1f3f4",
          border: "#dadce0",
          "border-soft": "#e8eaed",
          text: "#202124",
          "text-soft": "#3c4043",
          muted: "#5f6368",
          blue: "#1a73e8",
          "blue-soft": "#e8f0fe",
          green: "#188038",
          red: "#d93025",
          amber: "#f9ab00",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-roboto)",
          "Roboto",
          "Arial",
          "Helvetica Neue",
          "Helvetica",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
