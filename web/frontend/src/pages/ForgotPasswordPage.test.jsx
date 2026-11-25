import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import ForgotPasswordPage, { CHECK_INBOX_MESSAGE } from './ForgotPasswordPage'

// Password recovery request (feature 006). The API client is mocked so each
// backend outcome is driven explicitly.
vi.mock('../api/authClient', () => ({
  FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE: 'No se pudo enviar la solicitud. Intenta nuevamente',
  forgotPassword: vi.fn(),
}))

const authClient = await import('../api/authClient')

const NEUTRAL_MESSAGE =
  'Si el correo existe, recibirás un enlace para restablecer tu contraseña'

beforeEach(() => {
  authClient.forgotPassword.mockReset()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitEmail(user, email) {
  await user.type(screen.getByLabelText('Correo electrónico'), email)
  await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }))
}

describe('ForgotPasswordPage (feature 006)', () => {
  it('muestra el formulario y el enlace de vuelta al login', () => {
    renderPage()

    const heading = screen.getByRole('heading', { name: /recuperar contraseña/i })
    expect(heading.closest('main')).toHaveClass('page')
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email')
    expect(screen.getByRole('link', { name: /volver a iniciar sesión/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('correo vacío: muestra el obligatorio y no llama al backend', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /restablecer contraseña/i }))

    expect(await screen.findByText('El correo electrónico es obligatorio')).toBeInTheDocument()
    expect(authClient.forgotPassword).not.toHaveBeenCalled()
  })

  it('correo con formato inválido no se envía', async () => {
    const user = userEvent.setup()
    renderPage()

    await submitEmail(user, 'no-es-un-correo')

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument()
    expect(authClient.forgotPassword).not.toHaveBeenCalled()
  })

  it('mientras espera la respuesta muestra el estado de carga', async () => {
    let resolve
    authClient.forgotPassword.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await submitEmail(user, 'ana@example.com')

    const button = await screen.findByRole('button', { name: /enviando/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    resolve({ ok: true, message: NEUTRAL_MESSAGE })
    expect(await screen.findByTestId('forgot-password-sent')).toBeInTheDocument()
  })

  it('200: envía el correo normalizado y muestra "Revisa tu bandeja de entrada"', async () => {
    authClient.forgotPassword.mockResolvedValue({ ok: true, message: NEUTRAL_MESSAGE })
    const user = userEvent.setup()
    renderPage()

    await submitEmail(user, '  Ana@Example.COM ')

    const sent = await screen.findByTestId('forgot-password-sent')
    expect(sent).toHaveTextContent(CHECK_INBOX_MESSAGE)
    expect(sent).toHaveTextContent(NEUTRAL_MESSAGE)
    expect(authClient.forgotPassword).toHaveBeenCalledWith('ana@example.com')
    expect(
      screen.queryByRole('button', { name: /restablecer contraseña/i }),
    ).not.toBeInTheDocument()
  })

  it('fallo de red: mensaje fijo y el botón vuelve a habilitarse', async () => {
    authClient.forgotPassword.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()

    await submitEmail(user, 'ana@example.com')

    expect(await screen.findByTestId('forgot-password-error')).toHaveTextContent(
      'No se pudo enviar la solicitud. Intenta nuevamente',
    )
    expect(screen.getByRole('button', { name: /restablecer contraseña/i })).toBeEnabled()
    expect(screen.queryByTestId('forgot-password-sent')).not.toBeInTheDocument()
  })
})
