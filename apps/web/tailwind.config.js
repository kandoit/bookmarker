/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          light: '#ede9fe',
        },
      },
    },
  },
  plugins: [],
}
