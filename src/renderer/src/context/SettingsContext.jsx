import { createContext, useContext, useState, useEffect } from 'react'

const SettingsContext = createContext(null)

const DEFAULTS = { userName: 'Nelson Isidro' }

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.electron.invoke('settings:get').then(s => {
      setSettings({ ...DEFAULTS, ...s })
      setLoaded(true)
    })
  }, [])

  async function updateSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    await window.electron.invoke('settings:set', next)
  }

  if (!loaded) return null

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
