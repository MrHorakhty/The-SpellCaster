/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#090d16', // extremely dark slate for application backdrop
          900: '#0f172a', // slate-900
          800: '#1e293b', // slate-800 for sidebars / cards
          700: '#334155', // slate-700
          600: '#475569', // slate-600
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        fantaisie: ['Fantaisie', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
