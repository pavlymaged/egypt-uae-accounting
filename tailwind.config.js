/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '!./src/_legacy/**'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b0b8c9',
          400: '#8591aa',
          500: '#66728f',
          600: '#515b76',
          700: '#434a60',
          800: '#2b3040',
          900: '#1a1d27',
          950: '#0f1117',
        },
        brand: {
          50: '#effaf8',
          100: '#d8f2ee',
          200: '#b3e4dd',
          300: '#80cfc5',
          400: '#4db3a8',
          500: '#2f968c',
          600: '#237871',
          700: '#1f605b',
          800: '#1c4d4a',
          900: '#1a403e',
        },
        gold: {
          50: '#fdf8ec',
          100: '#f9eccb',
          200: '#f2d793',
          300: '#eabd5b',
          400: '#e4a535',
          500: '#d4881f',
          600: '#b96818',
          700: '#994b18',
          800: '#7d3c1a',
          900: '#673219',
        },
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in-left': 'slide-in-left 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
