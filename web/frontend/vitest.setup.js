import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SnackbarProvider } from './src/components/Snackbar'

// Toda prueba renderiza con el provider, como la app, para que los avisos de
// éxito de un componente aislado queden en el documento.
vi.mock('@testing-library/react', async (importOriginal) => {
  const rtl = await importOriginal()
  return {
    ...rtl,
    render: (ui, options) => rtl.render(ui, { wrapper: SnackbarProvider, ...options }),
  }
})

// Después de cada prueba, desmonta lo que se dibujó para que no se mezclen
afterEach(() => {
  cleanup()
})
