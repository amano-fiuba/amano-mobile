import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import './Snackbar.scss'

export const SNACKBAR_VISIBLE_MS = 5000
// Avisos de error de navegación de notificaciones (035 FR-019): 4 segundos.
export const SNACKBAR_ERROR_MS = 4000

// Sin provider (componentes montados aislados) mostrar un aviso no hace nada.
const SnackbarContext = createContext(() => {})

// Confirmaciones de acciones exitosas: vive por encima de las rutas, así el
// aviso sobrevive a la navegación que suele seguir a la acción. Se muestra uno
// por vez (el nuevo reemplaza al anterior y reinicia el tiempo). Los errores
// siguen junto al formulario o la fila que los originó.
export function SnackbarProvider({ children }) {
  const [snackbar, setSnackbar] = useState(null)
  const lastId = useRef(0)

  const showSnackbar = useCallback((message, duration = SNACKBAR_VISIBLE_MS) => {
    lastId.current += 1
    setSnackbar({ id: lastId.current, message, duration })
  }, [])

  useEffect(() => {
    if (!snackbar) {
      return undefined
    }
    const timer = setTimeout(() => setSnackbar(null), snackbar.duration ?? SNACKBAR_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [snackbar])

  return (
    <SnackbarContext.Provider value={showSnackbar}>
      {children}
      {snackbar && (
        <div key={snackbar.id} className="snackbar" role="status" data-testid="snackbar">
          <span>{snackbar.message}</span>
          <button
            type="button"
            className="text-button"
            aria-label="Cerrar notificación"
            onClick={() => setSnackbar(null)}
          >
            Cerrar
          </button>
        </div>
      )}
    </SnackbarContext.Provider>
  )
}

// Colocated on purpose (provider + hook live together, like AuthContext).
// eslint-disable-next-line react-refresh/only-export-components
export function useSnackbar() {
  return useContext(SnackbarContext)
}
