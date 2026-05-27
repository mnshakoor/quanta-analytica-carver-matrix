/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0C10',
        charcoal: '#101827',
        navy: '#1B2B4B',
        gold: '#C8A96E',
        sand: '#F4F1EA'
      },
      boxShadow: {
        card: '0 18px 55px rgba(0, 0, 0, 0.20)'
      }
    }
  },
  plugins: []
};
