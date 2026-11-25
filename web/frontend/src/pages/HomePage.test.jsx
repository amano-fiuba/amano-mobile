import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HomePage from './HomePage'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../auth/AuthContext', () => ({ useAuth }))

beforeEach(() => {
  useAuth.mockReturnValue({ user: null, loading: false })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('muestra el hero y las llamadas a la acción públicas', () => {
    renderPage()

    expect(
      screen.getByRole('heading', {
        name: 'Compartí gastos sin fricción ni cuentas complicadas',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Gestioná tus gastos personales y grupales/i),
    ).toBeInTheDocument()

    const main = screen.getByRole('main')
    expect(
      within(main).getByRole('link', { name: /empezar gratis/i }),
    ).toHaveAttribute('href', '/register')
    expect(
      within(main).getByRole('link', { name: /iniciar sesión/i }),
    ).toHaveAttribute('href', '/login')
  })

  it('presenta los cuatro beneficios, los tres pasos y los casos de uso', () => {
    renderPage()

    for (const title of [
      'Control personal y grupal',
      'Simplificación inteligente de deudas',
      'Perfiles Invitados (Sin registro obligatorio)',
      'Múltiples monedas y transparencia',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }

    expect(screen.getByText('Creá un grupo o registrá tu gasto.')).toBeInTheDocument()
    expect(
      screen.getByText('Agregá a los participantes (usuarios o perfiles invitados).'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A mano calcula los saldos y te avisa cómo saldar cuentas.'),
    ).toBeInTheDocument()

    for (const title of [
      'Para viajes en grupo',
      'Para convivientes y parejas',
      'Para salidas recurrentes entre amigos',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('permite alternar el mockup entre la ruta simplificada y el desglose original', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText('2 transferencias')).toBeInTheDocument()
    expect(screen.getByText('−6 movimientos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ver desglose original/i }))

    expect(screen.getByText('8 transferencias')).toBeInTheDocument()
    expect(screen.getByText('Sin optimizar')).toBeInTheDocument()
    expect(screen.getByText(/\+4 movimientos más/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /ver versión simplificada/i }),
    )

    expect(screen.getByText('2 transferencias')).toBeInTheDocument()
  })

  it('cambia el CTA principal por grupos cuando hay sesión', () => {
    useAuth.mockReturnValue({ user: { id: 7 }, loading: false })
    renderPage()

    const main = screen.getByRole('main')
    expect(
      within(main).getByRole('link', { name: /ir a mis grupos/i }),
    ).toHaveAttribute('href', '/groups')
    expect(
      within(main).queryByRole('link', { name: /empezar gratis/i }),
    ).not.toBeInTheDocument()
    expect(
      within(main).queryByRole('link', { name: /^iniciar sesión$/i }),
    ).not.toBeInTheDocument()
  })

  it('incluye los enlaces rápidos y el repositorio en el footer', () => {
    renderPage()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(
      within(footer).getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login')
    expect(
      within(footer).getByRole('link', { name: 'Registrarse' }),
    ).toHaveAttribute('href', '/register')
    expect(
      within(footer).getByRole('link', { name: /repositorio en github/i }),
    ).toHaveAttribute('href', 'https://github.com/amano-fiuba/amano')
  })
})
