import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import ResetPasswordPage, {
  EXPIRED_RESET_LINK_MESSAGE,
  INVALID_RESET_LINK_MESSAGE,
  RESET_SUCCESS_MESSAGE,
} from './ResetPasswordPage'

// New password screen (feature 006, US2). The API client is mocked so each
// backend outcome is driven explicitly.
vi.mock('../api/authClient', () => ({
  RESET_PASSWORD_NETWORK_ERROR_MESSAGE: 'No se pudo actualizar la contraseña. Intenta nuevamente',
  resetPassword: vi.fn(),
}))

const authClient = await import('../api/authClient')

const NEW_PASSWORD = 'NuevaClave123!'

beforeEach(() => {
  authClient.resetPassword.mockReset()
})

function LoginProbe() {
  return <div>LOGIN</div>
}

function renderPage(url = '/reset-password?token=token-del-correo') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/forgot-password" element={<div>OLVIDE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillAndSubmit(user, password, confirmation) {
  await user.type(screen.getByLabelText('Nueva contraseña'), password)
  await user.type(screen.getByLabelText('Confirmar contraseña'), confirmation)
  await user.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))
}

describe('ResetPasswordPage (feature 006, US2)', () => {
  it('muestra los dos campos de contraseña ocultos y los requisitos compartidos', () => {
    renderPage()

    const heading = screen.getByRole('heading', { name: /nueva contraseña/i })
    expect(heading.closest('main')).toHaveClass('page')
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAccessibleDescription(
      /Mínimo 8 caracteres/i,
    )
    expect(screen.getByText(/Mínimo 8 caracteres/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar contraseña')).toHaveAttribute('type', 'password')
  })

  it('sin token en la URL: enlace no válido sin llamar al backend', () => {
    renderPage('/reset-password')

    expect(screen.getByTestId('reset-password-dead-link')).toHaveTextContent(
      INVALID_RESET_LINK_MESSAGE,
    )
    expect(screen.getByRole('link', { name: /solicitar un nuevo enlace/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
    expect(authClient.resetPassword).not.toHaveBeenCalled()
  })

  it('campos vacíos: muestra los obligatorios y no llama al backend', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /guardar nueva contraseña/i }))

    expect(await screen.findByText('La contraseña es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('Debes confirmar la contraseña')).toBeInTheDocument()
    expect(authClient.resetPassword).not.toHaveBeenCalled()
  })

  it('contraseña que no cumple la política no se envía', async () => {
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, 'sinmayuscula1!', 'sinmayuscula1!')

    expect(
      await screen.findByText(
        'La contraseña debe incluir una mayúscula, una minúscula, un número y un símbolo',
      ),
    ).toBeInTheDocument()
    expect(authClient.resetPassword).not.toHaveBeenCalled()
  })

  it('confirmación distinta no se envía', async () => {
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, NEW_PASSWORD, 'OtraClave123!')

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(authClient.resetPassword).not.toHaveBeenCalled()
  })

  it('mientras espera la respuesta muestra el estado de carga', async () => {
    let resolve
    authClient.resetPassword.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByRole('button', { name: /guardando/i })).toBeDisabled()
    resolve({ ok: true, message: RESET_SUCCESS_MESSAGE })
    expect(await screen.findByText(/LOGIN/)).toBeInTheDocument()
  })

  it('200: envía token y contraseñas y redirige al login con el aviso', async () => {
    authClient.resetPassword.mockResolvedValue({ ok: true, message: RESET_SUCCESS_MESSAGE })
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByText('LOGIN')).toBeInTheDocument()
    expect(screen.getByTestId('snackbar')).toHaveTextContent(RESET_SUCCESS_MESSAGE)
    expect(authClient.resetPassword).toHaveBeenCalledWith(
      'token-del-correo',
      NEW_PASSWORD,
      NEW_PASSWORD,
    )
  })

  it('410: enlace vencido y ofrece pedir uno nuevo', async () => {
    authClient.resetPassword.mockResolvedValue({
      ok: false,
      status: 410,
      detail: EXPIRED_RESET_LINK_MESSAGE,
      fields: {},
    })
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, NEW_PASSWORD, NEW_PASSWORD)

    const deadLink = await screen.findByTestId('reset-password-dead-link')
    expect(deadLink).toHaveTextContent(EXPIRED_RESET_LINK_MESSAGE)
    expect(screen.getByRole('link', { name: /solicitar un nuevo enlace/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })

  it('400 sin campos: enlace no válido (ya usado o reemplazado)', async () => {
    authClient.resetPassword.mockResolvedValue({
      ok: false,
      status: 400,
      detail: INVALID_RESET_LINK_MESSAGE,
      fields: {},
    })
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByTestId('reset-password-dead-link')).toHaveTextContent(
      INVALID_RESET_LINK_MESSAGE,
    )
  })

  it('400 con campos: muestra los mensajes del servidor y conserva el formulario', async () => {
    authClient.resetPassword.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { password: 'Mensaje del servidor para la contraseña' },
    })
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByText('Mensaje del servidor para la contraseña')).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
  })

  it('fallo de red: mensaje fijo y el botón vuelve a habilitarse', async () => {
    authClient.resetPassword.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()

    await fillAndSubmit(user, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByTestId('reset-password-error')).toHaveTextContent(
      'No se pudo actualizar la contraseña. Intenta nuevamente',
    )
    expect(screen.getByRole('button', { name: /guardar nueva contraseña/i })).toBeEnabled()
  })
})
