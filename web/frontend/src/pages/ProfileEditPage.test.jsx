import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'

// Edición del perfil (specs/005-edit-user-profile, T007–T009/T016/T018):
// precarga fresca vía me() (FR-002), correo siempre deshabilitado (FR-007),
// validación en vivo + servidor por campo (FR-006/FR-010), cancelación sin
// guardar (FR-008), éxito con persistencia visible (FR-009/FR-012), avatar
// reemplazar/eliminar (FR-015/FR-016) y fallo de red sin cambios (FR-019).
//
// Mock del módulo del cliente (no del fetch global): el bootstrap del
// AuthProvider usa el fetch real stubbeado, la pantalla usa el mock explícito
// (mismo patrón que ProfilePage.test.jsx).
const PERFIL_COMPLETO = {
  id: 7,
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana.perez@example.com',
  currencies: ['ARS', 'USD'],
  cbuCvu: '0000003100010000000001',
  hasCustomAvatar: true,
  avatarUrl: '/api/users/7/avatar?v=3',
}

const PERFIL_EDICION_ACTUALIZADO = {
  ...PERFIL_COMPLETO,
  firstName: 'Anabel',
  lastName: 'Gómez',
  currencies: ['ARS', 'USD', 'EUR'],
  cbuCvu: '2850591001234567890123',
}

const PERFIL_MINIMO = {
  id: 7,
  firstName: 'Beto',
  lastName: null,
  email: 'beto@example.com',
  currencies: [],
  cbuCvu: null,
  hasCustomAvatar: false,
}

vi.mock('../api/authClient', () => ({
  UPDATE_NETWORK_ERROR_MESSAGE:
    'No se pudo completar la actualización. Intenta nuevamente',
  me: vi.fn(),
  updateProfile: vi.fn(),
  updateAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

import { deleteAvatar, me, updateAvatar, updateProfile } from '../api/authClient'
import ProfileEditPage from './ProfileEditPage'

beforeEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
  me.mockReset()
  updateProfile.mockReset()
  updateAvatar.mockReset()
  deleteAvatar.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function stubSesion(perfil) {
  const response = {
    ok: perfil !== null,
    status: perfil === null ? 401 : 200,
    json: () => Promise.resolve(perfil),
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

function renderEdit(initial = '/profile/edit') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/profile" element={<div>Pantalla de visualización</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function editarCompletamente(user) {
  // userEvent contra los campos precargados: se limpian antes de escribir
  // porque type() solo añade caracteres. Primero se espera la precarga
  // (FR-002): el reset() de react-hook-form puede llegar después del primer
  // render y pisaría lo tipeado (carrera Observable en jsdom).
  await waitFor(() => {
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana')
    expect(screen.getByLabelText('Apellido')).toHaveValue('Pérez')
  })
  const nombre = screen.getByLabelText('Nombre')
  await user.clear(nombre)
  await user.type(nombre, 'Anabel')
  const apellido = screen.getByLabelText('Apellido')
  await user.clear(apellido)
  await user.type(apellido, 'Gómez')
  const cbu = screen.getByLabelText('CBU/CVU')
  await user.clear(cbu)
  await user.type(cbu, '285-05910-0123 4567890123')
  return user.click(screen.getByRole('checkbox', { name: /euro/i }))
}

describe('ProfileEditPage (US1: precarga)', () => {
  it('precarga los datos actuales y el correo queda deshabilitado (FR-002, FR-007)', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    const nombre = await screen.findByLabelText('Nombre')
    expect(nombre).toHaveValue('Ana')
    expect(screen.getByLabelText('Apellido')).toHaveValue('Pérez')
    expect(screen.getByLabelText('CBU/CVU')).toHaveValue('0000003100010000000001')
    // SC-003: el mail es invariante — visible, siempre no editable.
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana.perez@example.com')
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /peso argentino/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /dólar/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /euro/i })).not.toBeChecked()
  })

  it('con opcionales ausentes precarga los campos vacíos y sin monedas (FR-002/FR-004, US1)', async () => {
    stubSesion(PERFIL_MINIMO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_MINIMO })
    renderEdit()

    expect(await screen.findByLabelText('Nombre')).toHaveValue('Beto')
    expect(screen.getByLabelText('Apellido')).toHaveValue('')
    expect(screen.getByLabelText('CBU/CVU')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: /peso argentino/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /euro/i })).not.toBeChecked()
  })

  it('fallo de red al precargar muestra el mensaje sin datos (FR-002/FR-019)', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockRejectedValue(new Error('network down'))
    renderEdit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no se pudo cargar el perfil/i,
    )
    expect(screen.queryByLabelText('Correo electrónico')).not.toBeInTheDocument()
  })
})

describe('ProfileEditPage (US1: guardar, validar, cancelar)', () => {
  it('guarda datos válidos normalizados, vuelve a la visualización y marca el aviso one-shot (FR-009, FR-012)', async () => {
    const user = userEvent.setup()
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    updateProfile.mockResolvedValue({ ok: true, profile: PERFIL_EDICION_ACTUALIZADO })
    renderEdit()

    await editarCompletamente(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledTimes(1)
    })
    const payload = updateProfile.mock.calls[0][0]
    expect(payload).toEqual({
      firstName: 'Anabel',
      lastName: 'Gómez',
      currencies: ['ARS', 'USD', 'EUR'],
      cbuCvu: '2850591001234567890123',
    })
    // FR-009 enmendado: el éxito navega a la visualización de 002.
    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
    // Aviso one-shot para que la visualización muestre el mensaje de éxito.
    expect(await screen.findByTestId('snackbar')).toHaveTextContent(
      /los cambios se guardaron correctamente/i,
    )
  })

  it('error de validación del servidor informa por campo y conserva los datos (FR-010)', async () => {
    const user = userEvent.setup()
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    updateProfile.mockResolvedValue({
      ok: false,
      status: 400,
      fields: { firstName: 'El nombre debe tener entre 2 y 50 caracteres' },
    })
    renderEdit()

    await editarCompletamente(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByText(/el nombre debe tener entre 2 y 50 caracteres/i))
      .toBeInTheDocument()
    // Los datos escritos se conservan para corregir sin repetir nada (crudos,
    // sin normalización: el trim y los 22 dígitos son del payload al enviar).
    expect(screen.getByLabelText('Apellido')).toHaveValue('Gómez')
    expect(screen.getByLabelText('CBU/CVU')).toHaveValue('285-05910-0123 4567890123')
    expect(screen.getByRole('checkbox', { name: /euro/i })).toBeChecked()
  })

  it('fallo de red al guardar muestra el mensaje fijo sin limpiar el formulario (FR-019)', async () => {
    const user = userEvent.setup()
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    updateProfile.mockResolvedValue({ ok: false, network: true })
    renderEdit()

    await editarCompletamente(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByText(/no se pudo completar la actualización/i))
      .toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Anabel')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('el botón Cancelar regresa a la visualización sin guardar nada (FR-008)', async () => {
    const user = userEvent.setup()
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    await editarCompletamente(user)
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
    // Cancelar nunca marca el aviso de guardado (FR-008).
    expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument()
  })

  it('no existe el botón "Volver atrás" (reemplazado por "Cancelar")', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    expect(await screen.findByRole('button', { name: /^cancelar$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /volver atrás/i })).not.toBeInTheDocument()
  })
})

describe('ProfileEditPage (US1: estado del botón Guardar, FR-011 enmendada, T027)', () => {
  it('sin modificaciones: Guardar deshabilitado y Cancelar habilitado', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    expect(await screen.findByRole('button', { name: /^guardar$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeEnabled()
  })

  it('modificar un campo habilita Guardar; volver al valor original lo deshabilita', async () => {
    const user = userEvent.setup()
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    const guardar = await screen.findByRole('button', { name: /^guardar$/i })
    expect(guardar).toBeDisabled()

    const nombre = screen.getByLabelText('Nombre')
    await user.clear(nombre)
    await user.type(nombre, 'Anabel')
    await waitFor(() => expect(guardar).toBeEnabled())

    // Volver al valor precargado limpia la pendiente: vuelve a deshabilitarse.
    await user.clear(nombre)
    await user.type(nombre, 'Ana')
    await waitFor(() => expect(guardar).toBeDisabled())
  })
  it('Modificar una moneda habilita; desmarcar la misma vuelve a cualquiera (conjunto)', async () => {
    const user = userEvent.setup()
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    const guardar = await screen.findByRole('button', { name: /^guardar$/i })
    const euro = screen.getByRole('checkbox', { name: /euro/i })

    await user.click(euro)
    expect(await waitFor(() => guardar)).toBeEnabled()

    await user.click(euro)
    await waitFor(() => expect(guardar).toBeDisabled())
  })
})

const prepararCarga = async () => {
  stubSesion(PERFIL_COMPLETO)
  me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
}

function pngFile(name = 'nueva.png') {
  // PNG magic bytes (89 50 4E 47) reales para la validación por contenido.
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    name,
    { type: 'image/png' },
  )
}

function gifFile(name = 'trampa.gif') {
  return new File(
    [new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39])],
    name,
    { type: 'image/gif' },
  )
}

describe('ProfileEditPage (US3: avatar pendiente hasta Guardar, FR-015/FR-016 enmendadas, T028)', () => {
  it('subir imagen válida NO dispara updateAvatar: queda pendiente y habilita Guardar', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    renderEdit()

    await user.upload(await screen.findByLabelText(/avatar:/i), pngFile())

    await waitFor(() => {
      const preview = screen.getByRole('img', { name: /avatar de ana/i })
      expect(preview.getAttribute('src')).toMatch(/^blob:/)
    })
    expect(updateAvatar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^guardar$/i })).toBeEnabled()
  })

  it('Guardar con avatar pendiente llama updateAvatar y vuelve a la visualización con el aviso one-shot', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    updateProfile.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    const avatarSubido = {
      ...PERFIL_COMPLETO,
      avatarUrl: '/api/users/7/avatar?v=7',
    }
    updateAvatar.mockResolvedValue({ ok: true, profile: avatarSubido })
    renderEdit()

    await user.upload(await screen.findByLabelText(/avatar:/i), pngFile())
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => {
      expect(updateAvatar).toHaveBeenCalledTimes(1)
    })
    expect(updateAvatar.mock.calls[0][0]).toBeInstanceOf(File)
    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
    expect(await screen.findByTestId('snackbar')).toHaveTextContent(
      /los cambios se guardaron correctamente/i,
    )
  })

  it('Cancelar con avatar pendiente descarta el pendiente sin ninguna llamada', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    renderEdit()

    await user.upload(await screen.findByLabelText(/avatar:/i), pngFile())
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
    expect(updateAvatar).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument()
  })

  it('Eliminar avatar queda pendiente: preview del default, botón deshabilitado, DELETE solo al Guardar', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    updateProfile.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    deleteAvatar.mockResolvedValue({ ok: true }) // 204 sin cuerpo
    renderEdit()

    expect(await screen.findByRole('button', { name: /eliminar avatar/i })).toBeEnabled()
    expect(deleteAvatar).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /eliminar avatar/i }))
    expect(screen.getByRole('img', { name: /avatar de ana/i }).getAttribute('src'))
      .toBe('/avatar-default.png')
    expect(screen.getByRole('button', { name: /eliminar avatar/i })).toBeDisabled()
    expect(deleteAvatar).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /^guardar$/i }))
    await waitFor(() => {
      expect(deleteAvatar).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
    expect(await screen.findByTestId('snackbar')).toHaveTextContent(
      /los cambios se guardaron correctamente/i,
    )
  })

  it('Cancelar con eliminación pendiente: ninguna llamada, pendiente descartado', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    renderEdit()

    await user.click(await screen.findByRole('button', { name: /eliminar avatar/i }))
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }))

    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
    expect(deleteAvatar).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument()
  })

  it('subida pendiente reemplaza la marca de eliminación: Guardar solo hace PUT', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    updateProfile.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    updateAvatar.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    // Marca la eliminación…
    await user.click(await screen.findByRole('button', { name: /eliminar avatar/i }))
    expect(screen.getByRole('img', { name: /avatar de ana/i }).getAttribute('src'))
      .toBe('/avatar-default.png')
    // …y luego elige un archivo: la subida reemplaza la marca.
    await user.upload(screen.getByLabelText(/avatar:/i), pngFile())
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /avatar de ana/i }).getAttribute('src'))
        .toMatch(/^blob:/)
    })

    await user.click(screen.getByRole('button', { name: /^guardar$/i }))
    await waitFor(() => {
      expect(updateAvatar).toHaveBeenCalledTimes(1)
    })
    expect(deleteAvatar).not.toHaveBeenCalled()
    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
  })

  it('con subida pendiente, presionar Eliminar descarta el archivo y marca la eliminación', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    updateProfile.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    deleteAvatar.mockResolvedValue({ ok: true }) // 204 sin cuerpo
    renderEdit()

    await user.upload(await screen.findByLabelText(/avatar:/i), pngFile())
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /avatar de ana/i }).getAttribute('src'))
        .toMatch(/^blob:/)
    })

    await user.click(screen.getByRole('button', { name: /eliminar avatar/i }))
    // El preview vuelve al default (marca de eliminación del vigente) y el
    // archivo pendiente se descarta; al Guardar solo va el DELETE.
    expect(screen.getByRole('img', { name: /avatar de ana/i }).getAttribute('src'))
      .toBe('/avatar-default.png')
    expect(screen.getByRole('button', { name: /eliminar avatar/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /^guardar$/i }))
    await waitFor(() => {
      expect(deleteAvatar).toHaveBeenCalledTimes(1)
    })
    expect(updateAvatar).not.toHaveBeenCalled()
    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
  })

  it('fallo del DELETE al Guardar: sin navegación, pendiente retenido y error visible', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    updateProfile.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    deleteAvatar.mockResolvedValue({ ok: false, network: true })
    renderEdit()

    await user.click(await screen.findByRole('button', { name: /eliminar avatar/i }))
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByText(/no se pudo completar la actualización/i))
      .toBeInTheDocument()
    // Sin navegación: seguimos en la pantalla de edición con la marca pendiente.
    expect(screen.getByRole('button', { name: /eliminar avatar/i })).toBeDisabled()
    expect(screen.getByRole('img', { name: /avatar de ana/i }).getAttribute('src'))
      .toBe('/avatar-default.png')
  })

  it('MIME mentiroso o > 25 MB no marca pendiente (mensajes en vivo, Guardar sigue deshabilitado si solo se intentó el avatar)', async () => {
    const user = userEvent.setup({ applyAccept: false })
    await prepararCarga()
    renderEdit()

    await user.upload(await screen.findByLabelText(/avatar:/i), gifFile())
    expect(await screen.findByText('El archivo debe ser una imagen JPG o PNG válida'))
      .toBeInTheDocument()
    expect(updateAvatar).not.toHaveBeenCalled()
    // El preview sigue con el avatar vigente (nada pendiente).
    expect(screen.getByRole('img', { name: /avatar de ana/i }).getAttribute('src'))
      .toBe('/api/users/7/avatar?v=3')
    expect(screen.getByRole('button', { name: /^guardar$/i })).toBeDisabled()

    const bytes = new Uint8Array(25 * 1024 * 1024 + 1)
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0)
    await user.upload(screen.getByLabelText(/avatar:/i),
      new File([bytes], 'grande.png', { type: 'image/png' }))
    expect(await screen.findByText(/la imagen es demasiado grande \(máximo 25 MB\)/i)).toBeInTheDocument()
    expect(updateAvatar).not.toHaveBeenCalled()
  })

  it('Guardar sin avatar pendiente se comporta como antes (sin DELETE ni PATCH de avatar)', async () => {
    const user = userEvent.setup()
    await prepararCarga()
    updateProfile.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderEdit()

    const nombre = await screen.findByLabelText('Nombre')
    await user.clear(nombre)
    await user.type(nombre, 'Anabel')
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByText('Pantalla de visualización')).toBeInTheDocument()
    expect(updateProfile).toHaveBeenCalledTimes(1)
    expect(updateAvatar).not.toHaveBeenCalled()
    expect(deleteAvatar).not.toHaveBeenCalled()
  })
})
