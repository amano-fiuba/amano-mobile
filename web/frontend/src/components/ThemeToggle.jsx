import { useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from './NavIcons'

// Toggle de modo claro/oscuro: escribe data-theme en <html>, persiste la
// preferencia en localStorage y arranca desde la preferencia guardada.
// index.html aplica el tema temprano para evitar el destello de tema incorrecto.
const STORAGE_KEY = 'amano-theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Modo privado/almacenamiento bloqueado: no persistir es aceptable.
    }
  }, [theme])

  const isDark = theme === 'dark'
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  return (
    <button
      type="button"
      className="app-header__action"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
