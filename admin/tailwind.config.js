/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FFFFFF',
        cream: '#F7F7F5',
        forest: '#242522',
        moss: '#646660',
        sage: '#B8BAB5',
        bark: '#70726D',
        leaf: '#3A3B38',
        line: '#E5E6E2',
      },
    },
  },
  plugins: [],
}
