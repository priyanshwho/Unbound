import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from './theme-context'

type Theme = 'dark' | 'light'
function getInitialTheme(): Theme {
  const saved = window.localStorage.getItem('unbound-theme')
  return saved === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('unbound-theme', theme)
  }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(value => value === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>
}
