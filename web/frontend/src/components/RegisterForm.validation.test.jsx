import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterForm from './RegisterForm'

// Live-validation contract of US2 (task T027), written BEFORE the TextField
// refactor: FR-013/FR-014/FR-015/FR-017/FR-018/FR-020, SC-003/SC-005/SC-006,
// and the clarifications Q3 (CBU normalize) / Q4 (names trim before measure).
vi.mock('../api/authClient', () => ({
  NETWORK_ERROR_MESSAGE: 'No se pudo completar el registro. Intenta nuevamente',
  register: vi.fn(),
  me: vi.fn(),
}))

const authClient = await import('../api/authClient')

beforeEach(() => {
  vi.unstubAllGlobals()
  authClient.register.mockReset()
  authClient.me.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function renderForm(onRegistered = vi.fn()) {
  return render(<RegisterForm onRegistered={onRegistered} />)
}

async function fillValidForm(user) {
  // Sequential on purpose: concurrent userEvent operations on the same user
  // interleave keystrokes and corrupt the form state (RHF uncontrolled inputs).
  await user.type(screen.getByLabelText(/^Nombre \*/), 'Ana')
  await user.type(screen.getByLabelText(/^Correo electrónico \*/), 'ana.perez@example.com')
  await user.type(screen.getByLabelText(/^Contraseña \*/), 'Password123!')
  await user.type(screen.getByLabelText(/^Confirmar contraseña \*/), 'Password123!')
  await user.click(screen.getByLabelText(/Términos y Condiciones/i))
}

/** Resolves once the text is visible; measures real elapsed time in ms. */
async function findWithinTwoSeconds(text) {
  const startedAt = Date.now()
  const node = await screen.findByText(text, {}, { timeout: 2000 })
  const elapsed = Date.now() - startedAt
  return { node, elapsed }
}

describe('RegisterForm — validación en vivo (T027)', () => {
  it('mensaje por campo al perder foco en < 2 s sin limpiar el resto (FR-013/FR-018/SC-003)', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/^Correo electrónico \*/), 'ana.perez@example.com')
    await user.type(screen.getByLabelText(/^Nombre \*/), 'A')
    await user.tab() // blur of the invalid field

    const { elapsed } = await findWithinTwoSeconds('El nombre debe tener entre 2 y 50 caracteres')
    expect(elapsed).toBeLessThan(2000) // SC-003 (medición real; RHF+userEvent no son compatibles con fakeTimers)
    // no other data is cleaned (FR-014)
    expect(screen.getByLabelText(/^Correo electrónico \*/)).toHaveDisplayValue('ana.perez@example.com')
  })

  it('CBU con espacios/guiones se normaliza en el blur y se valida 22 dígitos (Q3)', async () => {
    const user = userEvent.setup()
    renderForm()

    const cbu = screen.getByLabelText('CBU/CVU')
    await user.type(cbu, '285 05910-0123 4567890123')
    await user.tab()

    await vi.waitFor(() => expect(cbu).toHaveDisplayValue('2850591001234567890123'))
  })

  it('CBU con 21 dígitos muestra el mensaje exacto (Q3/FR-009)', async () => {
    const user = userEvent.setup()
    renderForm()

    const cbu = screen.getByLabelText('CBU/CVU')
    await user.type(cbu, '285059100123456789012')
    await user.tab()

    const { elapsed } = await findWithinTwoSeconds('El CBU/CVU debe tener 22 dígitos')
    expect(elapsed).toBeLessThan(2000)
  })

  it('nombre/apellido se trimean en el blur antes de medir (Q4)', async () => {
    const user = userEvent.setup()
    renderForm()

    const nombre = screen.getByLabelText(/^Nombre \*/)
    await user.type(nombre, 'Ana   ')
    await user.tab()

    await vi.waitFor(() => expect(nombre).toHaveDisplayValue('Ana'))
  })

  it('doble submit rápido ⇒ una sola llamada al cliente (FR-015/SC-005)', async () => {
    const user = userEvent.setup()
    let releaseResponse
    authClient.register.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseResponse = () => resolve({ ok: false, network: true })
        }),
    )
    renderForm()

    await fillValidForm(user)
    const button = screen.getByRole('button', { name: /crear cuenta/i })
    await user.click(button)
    await user.click(button) // button must be disabled: ignored while the first one is pending

    releaseResponse()
    await screen.findByText('No se pudo completar el registro. Intenta nuevamente')
    expect(authClient.register).toHaveBeenCalledTimes(1)
  })

  it('éxito ⇒ onRegistered recibe el correo (no el perfil) y no hay sesión (FR-001, T015)', async () => {
    const user = userEvent.setup()
    const onRegistered = vi.fn()
    authClient.register.mockResolvedValue({ ok: true, email: 'ana.perez@example.com' })
    renderForm(onRegistered)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(onRegistered).toHaveBeenCalledTimes(1)
    expect(onRegistered).toHaveBeenCalledWith('ana.perez@example.com')
  })

  it.each([
    ['400 con fields', { ok: false, status: 400, detail: 'La solicitud contiene campos inválidos', fields: { email: 'Ingresa un correo electrónico válido' } }],
    ['409 duplicado', { ok: false, status: 409, detail: 'El correo electrónico ya se encuentra registrado', fields: { email: 'El correo electrónico ya se encuentra registrado' } }],
    ['fallo de red', { ok: false, network: true }],
  ])('ante %s el botón se rehabilita de inmediato (FR-017)', async (_case, response) => {
    authClient.register.mockResolvedValue(response)
    renderForm()

    const user = userEvent.setup()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(
      await screen.findByRole('button', { name: /crear cuenta/i }),
    ).toBeEnabled()
  })

  it('abandonar sin enviar no persiste nada (FR-020/SC-006)', async () => {
    const user = userEvent.setup()
    const { unmount } = renderForm()

    await user.type(screen.getByLabelText(/^Nombre \*/), 'Ana')
    await user.type(screen.getByLabelText(/^Correo electrónico \*/), 'ana.perez@example.com')
    unmount()

    expect(authClient.register).not.toHaveBeenCalled()
  })
})

describe('RegisterForm — indicación de obligatorios (T044, FR-023)', () => {
  it('los campos obligatorios llevan asterisco y Apellido/CBU no', () => {
    renderForm()

    expect(screen.getByLabelText(/^Nombre \*/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Correo electrónico \*/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Contraseña \*/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Confirmar contraseña \*/)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Términos y Condiciones/i).closest('label').textContent,
    ).toContain('*')

    expect(screen.queryByLabelText(/Apellido \*/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/CBU\/CVU \*/)).not.toBeInTheDocument()
  })

  it('muestra la nota de obligatorios antes del botón de envío (FR-023)', () => {
    renderForm()

    const note = screen.getByTestId('required-fields-note')
    expect(note).toHaveTextContent('Los campos con (*) son obligatorios')
    expect(note.compareDocumentPosition(screen.getByRole('button', { name: /crear cuenta/i })))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
