/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        noir: {
          black: '#000000',
          dark: '#080808',
          card: '#101010',
          border: '#1E1E1E',
          borderLight: '#2A2A2A',
          muted: '#737373',
          red: '#D71921',
          redHover: '#B5141B',
          white: '#F5F5F5'
        }
      },
      fontFamily: {
        mono: ['"Courier New"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
