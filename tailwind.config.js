/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          50: '#fdf6f0', 100: '#faead9', 200: '#f4d0ad', 300: '#edb079',
          400: '#e58a4f', 500: '#d96f2e', 600: '#c95a23', 700: '#a7451d',
          800: '#873a1f', 900: '#6f311d', 950: '#3b1710',
        },
        accent: {
          50: '#f0f9f4', 100: '#dbf2e3', 200: '#bae5ca', 300: '#8dd3a6',
          400: '#57ba7d', 500: '#339e5e', 600: '#237f49', 700: '#1c653d',
          800: '#195033', 900: '#15422c', 950: '#0a2618',
        },
        neutral: {
          50: '#faf8f5', 100: '#f2eee8', 200: '#e3dccf', 300: '#cdc0ac',
          400: '#b1a085', 500: '#9d8a6e', 600: '#856f56', 700: '#6e5b47',
          800: '#5b4d3e', 900: '#4d4236', 950: '#2a221b',
        },
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgba(0,0,0,0.08)',
        card: '0 4px 24px -6px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
