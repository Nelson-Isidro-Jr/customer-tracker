// Theme engine. Tailwind's color classes (blue, slate, emerald, …) are wired
// to CSS variables in tailwind.config.js, so applying a theme here re-colors
// every existing button, card, table, and badge without touching components.
//
// Variables are "r g b" triplets so Tailwind opacity modifiers keep working:
//   --c-<palette>-<shade>  background / border / ring / gradient colors
//   --t-<palette>-<shade>  text colors (differ from --c- in dark mode)

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

// Tailwind palettes, in SHADES order
const TW = {
  blue:    ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'],
  indigo:  ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#1e1b4b'],
  slate:   ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#020617'],
  emerald: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'],
  red:     ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a'],
  amber:   ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#451a03'],
  orange:  ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#431407'],
  violet:  ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#2e1065'],
  purple:  ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#3b0764'],
  pink:    ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843', '#500724'],
  fuchsia: ['#fdf4ff', '#fae8ff', '#f5d0fe', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf', '#86198f', '#701a75', '#4a044e'],
  teal:    ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e'],
  cyan:    ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#083344']
}

// Dark-mode grays, tuned by hand so surfaces step up gently and text stays crisp
const DARK_GRAY_BG   = ['#151d2c', '#1b2436', '#263044', '#36425a', '#56637c', '#76839b', '#97a3b8', '#b8c2d3', '#d6dde8', '#eef2f7', '#f8fafc']
const DARK_GRAY_TEXT = ['#0f1623', '#1b2436', '#2e394d', '#4a5670', '#6e7b93', '#8f9bb0', '#a9b4c6', '#c5cedb', '#dee4ec', '#f1f5f9', '#ffffff']

export const PRESETS = {
  light:    { label: 'Light',    mode: 'light', brand: TW.blue,   brand2: TW.indigo,  sidebar: '#0b1120', page: '#f1f5f9' },
  dark:     { label: 'Dark',     mode: 'dark',  brand: TW.blue,   brand2: TW.indigo,  sidebar: '#060a13', page: '#0b1120', surface: '#111827' },
  pink:     { label: 'Pink',     mode: 'light', brand: TW.pink,   brand2: TW.fuchsia, sidebar: '#3b0a26', page: '#fdf2f8' },
  ocean:    { label: 'Ocean',    mode: 'light', brand: TW.teal,   brand2: TW.cyan,    sidebar: '#042f2e', page: '#effcfa' },
  lavender: { label: 'Lavender', mode: 'light', brand: TW.violet, brand2: TW.purple,  sidebar: '#1d1035', page: '#f5f3ff' }
}

export const DEFAULT_CUSTOM = { mode: 'light', brand: '#2563eb', sidebar: '#0b1120', page: '#f1f5f9' }

// ─── Color math ───────────────────────────────────────────────────────────────

const clamp = (n, lo = 0, hi = 255) => Math.min(hi, Math.max(lo, n))

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0]
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('')
}

export function isHex(v) { return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim()) }

// Blend a toward b; t = 0 → a, t = 1 → b
export function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b)
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t))
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const triplet = hex => hexToRgb(hex).join(' ')

// A full 50–950 scale from one color. The picked color becomes shade 600 (the
// button color), darkened just enough that white button text stays readable.
export function scaleFrom(hex) {
  let base = rgbToHex(hexToRgb(hex))
  for (let i = 0; i < 12 && contrast(base, '#ffffff') < 3.2; i++) base = mix(base, '#000000', 0.08)
  const toWhite = [0.94, 0.87, 0.74, 0.56, 0.34, 0.15]
  const toBlack = [0.15, 0.3, 0.45, 0.62]
  return [
    ...toWhite.map(t => mix(base, '#ffffff', t)),
    base,
    ...toBlack.map(t => mix(base, '#000000', t))
  ]
}

// ─── Building a theme ─────────────────────────────────────────────────────────

function resolve(setting) {
  const preset = setting?.preset || 'light'
  if (preset === 'custom') {
    const c = { ...DEFAULT_CUSTOM, ...(setting.custom || {}) }
    const brand = scaleFrom(c.brand)
    const dark = c.mode === 'dark'
    return {
      key: 'custom',
      mode: dark ? 'dark' : 'light',
      brand,
      brand2: brand.map(h => mix(h, '#1e1b4b', 0.18)),
      sidebar: isHex(c.sidebar) ? c.sidebar : DEFAULT_CUSTOM.sidebar,
      page: isHex(c.page) ? c.page : (dark ? '#0b1120' : '#f1f5f9'),
      surface: dark ? mix(isHex(c.page) ? c.page : '#0b1120', '#ffffff', 0.05) : '#ffffff'
    }
  }
  const p = PRESETS[preset] || PRESETS.light
  return { key: preset, mode: p.mode, brand: p.brand, brand2: p.brand2, sidebar: p.sidebar, page: p.page, surface: p.surface || '#ffffff' }
}

// Light mode uses palettes as-is. Dark mode turns pale tints (50–300) into deep
// tints of the hue for backgrounds, and lifts dark shades for text, so a
// "bg-emerald-50 text-emerald-700" badge reads well on either surface.
function darkBg(pal, surface) {
  return pal.map((h, i) => (i <= 3 ? mix(pal[5], surface, [0.86, 0.78, 0.64, 0.45][i]) : h))
}
function darkText(pal) {
  const map = [0, 1, 2, 3, 3, 4, 4, 3, 2, 1, 0]
  return map.map(i => pal[i])
}

export function buildTheme(setting) {
  const t = resolve(setting)
  const dark = t.mode === 'dark'
  const vars = {}
  const put = (kind, name, pal) => pal.forEach((hex, i) => { vars[`--${kind}-${name}-${SHADES[i]}`] = triplet(hex) })

  const palettes = {
    brand: t.brand,
    brand2: t.brand2,
    emerald: TW.emerald,
    red: TW.red,
    amber: TW.amber,
    orange: TW.orange,
    violet: TW.violet
  }
  for (const [name, pal] of Object.entries(palettes)) {
    put('c', name, dark ? darkBg(pal, t.surface) : pal)
    put('t', name, dark ? darkText(pal) : pal)
  }
  put('c', 'gray', dark ? DARK_GRAY_BG : TW.slate)
  put('t', 'gray', dark ? DARK_GRAY_TEXT : TW.slate)

  // Sidebar ink follows the sidebar color, so a light custom sidebar gets dark text
  const sidebarIsLight = luminance(t.sidebar) > 0.45
  const fg = sidebarIsLight ? '#0f172a' : '#ffffff'
  vars['--c-surface'] = triplet(t.surface)
  vars['--c-page'] = triplet(t.page)
  vars['--c-sidebar'] = triplet(t.sidebar)
  vars['--c-sidebar-fg'] = triplet(fg)
  vars['--c-sidebar-muted'] = triplet(mix(fg, t.sidebar, 0.38))
  vars['--c-sidebar-dim'] = triplet(mix(fg, t.sidebar, 0.58))
  vars['--c-sidebar-faint'] = triplet(mix(fg, t.sidebar, 0.7))
  vars['--c-sidebar-accent'] = triplet(sidebarIsLight ? t.brand[6] : t.brand[4])

  // Resolved hex values for charts (SVG attributes cannot read CSS variables)
  const colors = {
    mode: t.mode,
    page: t.page,
    surface: t.surface,
    sidebar: t.sidebar,
    current: dark ? t.brand[5] : t.brand[6],
    previous: dark ? mix(t.brand[5], t.surface, 0.55) : t.brand[3],
    decline: dark ? TW.red[4] : '#e34948',
    grid: dark ? DARK_GRAY_BG[1] : '#eef2f6',
    axis: dark ? DARK_GRAY_BG[3] : TW.slate[3],
    tick: dark ? DARK_GRAY_TEXT[4] : TW.slate[4],
    cursor: dark ? DARK_GRAY_BG[0] : TW.slate[1],
    ink: dark ? DARK_GRAY_TEXT[8] : TW.slate[7],
    brand: t.brand,
    brand2: t.brand2
  }
  return { key: t.key, mode: t.mode, vars, colors }
}

const CACHE_KEY = 'ct-theme-vars'

export function applyTheme(setting) {
  const theme = buildTheme(setting)
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
  root.dataset.theme = theme.mode
  root.style.colorScheme = theme.mode
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(theme.vars)) } catch (_) {}
  return theme
}

// Runs before React renders so the very first frame already has the user's
// colors (falls back to the light theme on first launch).
export function applyCachedTheme() {
  let vars = null
  try { vars = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch (_) {}
  if (!vars) return applyTheme({ preset: 'light' })
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  return null
}

// Small swatch set for previews in Settings
export function previewOf(setting) {
  const t = resolve(setting)
  return { mode: t.mode, brand: t.brand[6], brand2: t.brand2[7], sidebar: t.sidebar, page: t.page, surface: t.surface, tint: t.brand[1] }
}
