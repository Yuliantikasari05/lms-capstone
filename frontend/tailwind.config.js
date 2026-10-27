/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0E1B33',
          900: '#14284B',
          800: '#1C3563',
          700: '#2A4678',
        },
        brand: {
          50: '#EEF3FF',
          100: '#DCE7FF',
          500: '#3A66D8',
          600: '#2D52B8',
          700: '#233F93',
        },
        gold: {
          400: '#F2B84B',
          500: '#E5A52A',
        },
        surface: '#F4F6FA',
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
