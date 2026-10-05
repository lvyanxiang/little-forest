/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FDFAF3',
        cream: '#F5EFE0',
        forest: '#1E3A1E',
        moss: '#5C7A3A',
        sage: '#8FAF6B',
        bark: '#8A7558',
        leaf: '#2D5016',
        line: '#D8CFC4',
      },
    },
  },
  plugins: [],
}
