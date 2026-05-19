/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fefdf9',
          100: '#fdf8ed',
          200: '#faf0d7',
          300: '#f5e4b8',
        },
        amber: {
          warm: '#c8813a',
          light: '#e8a95c',
          muted: '#d4956b',
        },
        sage: {
          50: '#f4f7f2',
          100: '#e8efe5',
          200: '#cfdfc9',
          300: '#a8c49f',
          400: '#7ba372',
          500: '#5a8352',
          600: '#446642',
        },
        stone: {
          warm: '#8c7b6e',
          light: '#c4b5a8',
          dark: '#4a3f38',
        },
        cru: {
          blue: '#007398',
          'blue-light': '#3eb1c8',
          gold: '#f9b625',
          gray: '#666062',
        },
      },
      boxShadow: {
        'card': '0 2px 12px rgba(74, 63, 56, 0.08)',
        'card-hover': '0 4px 20px rgba(74, 63, 56, 0.14)',
        'modal': '0 8px 40px rgba(74, 63, 56, 0.2)',
      },
    },
  },
  plugins: [],
}
