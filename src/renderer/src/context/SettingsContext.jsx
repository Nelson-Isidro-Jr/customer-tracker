import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { applyTheme, buildTheme } from '../theme'

const SettingsContext = createContext(null)
const ThemeContext = createContext(null)

const DEFAULTS = {
  userName: 'Nelson Isidro',
  pesosPerPoint: 10000,
  showGreeting: true,
  theme: { preset: 'light' }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  // A theme being previewed (custom color editor) without being saved yet
  const [preview, setPreview] = useState(null)
  const fadeTimer = useRef(null)

  useEffect(() => {
    window.electron.invoke('settings:get').then(s => {
      setSettings({ ...DEFAULTS, ...s })
      setLoaded(true)
    })
  }, [])

  const activeTheme = preview || settings.theme
  const theme = useMemo(() => buildTheme(activeTheme), [activeTheme])

  // Apply on every change, crossfading colors briefly after the first paint
  useEffect(() => {
    if (!loaded) return
    const root = document.documentElement
    root.classList.add('theme-transition')
    applyTheme(activeTheme)
    clearTimeout(fadeTimer.current)
    fadeTimer.current = setTimeout(() => root.classList.remove('theme-transition'), 420)
  }, [activeTheme, loaded])

  // Ref mirror so back-to-back updates each build on the latest values
  const latest = useRef(settings)
  latest.current = settings

  const updateSettings = useCallback(async (patch) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setSettings(next)
    await window.electron.invoke('settings:set', next)
  }, [])

  if (!loaded) return null

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      <ThemeContext.Provider value={{ ...theme, setPreview }}>
        {children}
      </ThemeContext.Provider>
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)

// Resolved colors for charts plus setPreview(themeSetting | null) for live previews
export const useTheme = () => useContext(ThemeContext)
