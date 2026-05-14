/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        navy: {
          900: '#0B1120',
          800: '#0F172A',
          700: '#1E293B'
        }
      },
      animation: {
        'count-up': 'countUp 0.6s ease-out forwards'
      }
    }
  },
  plugins: []
}
