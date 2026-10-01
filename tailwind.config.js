// Every palette the app uses points at a CSS variable set by
// src/renderer/src/theme/index.js, so switching themes re-colors the whole UI.
// Backgrounds, borders, rings, and gradients read --c-*; text reads --t-*,
// which lets dark mode lighten text without washing out solid buttons.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const PALETTES = {
  blue: 'brand',
  indigo: 'brand2',
  slate: 'gray',
  emerald: 'emerald',
  red: 'red',
  amber: 'amber',
  orange: 'orange',
  violet: 'violet'
}

const variable = name => `rgb(var(--${name}) / <alpha-value>)`
const scale = (name, kind) => Object.fromEntries(SHADES.map(s => [s, variable(`${kind}-${name}-${s}`)]))
const scales = kind => Object.fromEntries(Object.entries(PALETTES).map(([tw, name]) => [tw, scale(name, kind)]))

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        ...scales('c'),
        brand: scale('brand', 'c'),
        surface: variable('c-surface'),
        page: variable('c-page'),
        sidebar: {
          DEFAULT: variable('c-sidebar'),
          fg: variable('c-sidebar-fg'),
          muted: variable('c-sidebar-muted'),
          dim: variable('c-sidebar-dim'),
          faint: variable('c-sidebar-faint'),
          accent: variable('c-sidebar-accent')
        },
        // Always-white overlay for glass effects on colored backgrounds
        glass: '#ffffff',
        navy: {
          900: '#0B1120',
          800: '#0F172A',
          700: '#1E293B'
        }
      },
      textColor: {
        ...scales('t'),
        brand: scale('brand', 't')
      },
      backgroundColor: {
        // Cards, modals, and inputs use bg-white; it follows the theme surface
        white: variable('c-surface')
      },
      animation: {
        'count-up': 'countUp 0.6s ease-out forwards',
        'row-in': 'rowIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite'
      },
      keyframes: {
        rowIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' }
        }
      }
    }
  },
  plugins: []
}
