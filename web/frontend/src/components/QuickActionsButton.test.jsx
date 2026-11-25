import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuickActionsButton from './QuickActionsButton'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../auth/AuthContext', () => ({ useAuth }))

const { listGroups, listFriends } = vi.hoisted(() => ({ listGroups: vi.fn(), listFriends: vi.fn() }))
vi.mock('../api/friendsClient', async (importOriginal) => ({ ...(await importOriginal()), listFriends }))
vi.mock('../api/groupsClient', async (importOriginal) => ({ ...(await importOriginal()), listGroups }))

function renderButton() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<QuickActionsButton />} />
        <Route path="/expenses/new" element={<p>Pantalla de gasto personal</p>} />
        <Route path="/groups/new" element={<p>Pantalla de crear grupo</p>} />
        <Route path="/incomes/new" element={<p>Pantalla de ingreso personal</p>} />
        <Route path="/groups/:id/expenses/new" element={<p>Nuevo gasto del grupo</p>} />
        <Route path="/friends/:friendId/expenses/new" element={<p>Nuevo gasto con amigo</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openMenu(user) {
  await user.click(screen.getByRole('button', { name: 'Acciones rápidas' }))
  return screen.getByRole('menuitem', { name: 'Registrar gasto' })
}

function setMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 7 } })
  setMatchMedia(false)
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('QuickActionsButton (015, US4)', () => {
  it('sin sesión no se muestra', () => {
    useAuth.mockReturnValue({ user: null })
    renderButton()

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('despliega las acciones de creación', async () => {
    const user = userEvent.setup()
    renderButton()

    await openMenu(user)

    expect(screen.getByRole('menu', { name: 'Acciones rápidas' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Crear grupo' })).toHaveAttribute('href', '/groups/new')
    expect(screen.getByRole('menuitem', { name: 'Gastos recurrentes' })).toHaveAttribute(
      'href',
      '/expenses/recurring',
    )
  })

  it('ofrece "Registrar ingreso" entre "Registrar gasto" y "Gastos recurrentes"', async () => {
    const user = userEvent.setup()
    renderButton()

    await openMenu(user)

    const menu = screen.getByRole('menu', { name: 'Acciones rápidas' })
    const items = within(menu).getAllByRole('menuitem', { hidden: false })
    const labels = items.map((item) => item.textContent)
    expect(labels.indexOf('Registrar ingreso')).toBe(labels.indexOf('Registrar gasto') + 1)
    expect(labels.indexOf('Gastos recurrentes')).toBe(labels.indexOf('Registrar ingreso') + 1)
    expect(screen.getByRole('menuitem', { name: 'Registrar ingreso' })).toHaveAttribute(
      'href',
      '/incomes/new',
    )
  })

  it('"Registrar ingreso" abre el alta de ingreso y cierra el menú', async () => {
    const user = userEvent.setup()
    renderButton()

    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Registrar ingreso' }))

    expect(screen.getByText('Pantalla de ingreso personal')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('se cierra al elegir una opción', async () => {
    const user = userEvent.setup()
    renderButton()

    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Crear grupo' }))

    expect(screen.getByText('Pantalla de crear grupo')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('QuickActionsButton: submenú "Registrar gasto" (027, US1)', () => {
  it('"Registrar gasto" anuncia un submenú cerrado', async () => {
    const user = userEvent.setup()
    renderButton()

    const trigger = await openMenu(user)

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu', { name: 'Registrar gasto' })).not.toBeInTheDocument()
  })

  it('se abre con clic y muestra solo las opciones habilitadas', async () => {
    const user = userEvent.setup()
    renderButton()

    const trigger = await openMenu(user)
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Registrar gasto' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Gasto personal' })).toHaveAttribute(
      'href',
      '/expenses/new',
    )
    expect(screen.getByRole('menuitem', { name: 'Gasto grupal' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Gasto con amigo' })).toBeInTheDocument()
    // Orden de FR-001: personal, con amigo, grupal.
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent).filter((text) => text.startsWith('Gasto ')),
    ).toEqual(['Gasto personal', 'Gasto con amigo', 'Gasto grupal'])
  })

  it('un segundo clic sobre "Registrar gasto" cierra el submenú', async () => {
    const user = userEvent.setup()
    renderButton()

    const trigger = await openMenu(user)
    await user.click(trigger)
    await user.click(trigger)

    expect(screen.queryByRole('menu', { name: 'Registrar gasto' })).not.toBeInTheDocument()
  })

  it('se abre con hover y se cierra al salir, con un pequeño retardo', async () => {
    vi.useFakeTimers()
    renderButton()

    fireEvent.click(screen.getByRole('button', { name: 'Acciones rápidas' }))
    const item = screen.getByRole('menuitem', { name: 'Registrar gasto' }).closest('li')

    fireEvent.mouseEnter(item)
    expect(screen.getByRole('menu', { name: 'Registrar gasto' })).toBeInTheDocument()

    fireEvent.mouseLeave(item)
    // Volver antes del retardo lo mantiene abierto.
    fireEvent.mouseEnter(item)
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByRole('menu', { name: 'Registrar gasto' })).toBeInTheDocument()

    fireEvent.mouseLeave(item)
    act(() => vi.advanceTimersByTime(300))
    expect(screen.queryByRole('menu', { name: 'Registrar gasto' })).not.toBeInTheDocument()
  })

  it('"Gasto personal" lleva al formulario y cierra todo el menú', async () => {
    const user = userEvent.setup()
    renderButton()

    await user.click(await openMenu(user))
    await user.click(screen.getByRole('menuitem', { name: 'Gasto personal' }))

    expect(screen.getByText('Pantalla de gasto personal')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('con teclado: flecha derecha abre y enfoca la primera opción; flecha izquierda vuelve', async () => {
    const user = userEvent.setup()
    renderButton()

    const trigger = await openMenu(user)
    trigger.focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('menuitem', { name: 'Gasto personal' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')

    expect(screen.queryByRole('menu', { name: 'Registrar gasto' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('con teclado: Enter abre el submenú y Escape lo cierra devolviendo el foco', async () => {
    const user = userEvent.setup()
    renderButton()

    const trigger = await openMenu(user)
    trigger.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('menuitem', { name: 'Gasto personal' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu', { name: 'Registrar gasto' })).not.toBeInTheDocument()
    // Solo se cierra el submenú: el menú principal sigue abierto.
    expect(screen.getByRole('menu', { name: 'Acciones rápidas' })).toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('con teclado: las flechas recorren los ítems del menú', async () => {
    const user = userEvent.setup()
    renderButton()

    await openMenu(user)
    const first = screen.getByRole('menuitem', { name: 'Crear grupo' })
    first.focus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Registrar gasto' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Registrar ingreso' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Gastos recurrentes' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(first).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Gastos recurrentes' })).toHaveFocus()
  })

  it('Escape en el menú principal cierra todo', async () => {
    const user = userEvent.setup()
    renderButton()

    await user.click(await openMenu(user))
    screen.getByRole('menuitem', { name: 'Crear grupo' }).focus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('un clic fuera cierra el menú y el submenú', async () => {
    const user = userEvent.setup()
    renderButton()

    await user.click(await openMenu(user))
    await user.click(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('si no entra a la derecha, el submenú se ubica en la posición alternativa', async () => {
    const user = userEvent.setup()
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 200,
      right: window.innerWidth + 50,
      bottom: 100,
      width: 300,
      height: 100,
      x: 200,
      y: 0,
    })
    renderButton()

    await user.click(await openMenu(user))

    expect(screen.getByRole('menu', { name: 'Registrar gasto' })).toHaveClass(
      'quick-actions__submenu--flip',
    )
  })

  it('en móvil el submenú reemplaza la lista y "Volver" regresa', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderButton()

    await user.click(await openMenu(user))

    expect(screen.queryByRole('menuitem', { name: 'Crear grupo' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Gasto personal' })).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Volver' }))

    expect(screen.getByRole('menuitem', { name: 'Crear grupo' })).toBeInTheDocument()
    expect(screen.queryByRole('menu', { name: 'Registrar gasto' })).not.toBeInTheDocument()
  })
})

describe('QuickActionsButton: "Gasto grupal" (027, US3)', () => {
  it('cierra el menú, pide el grupo y lleva a su nuevo gasto', async () => {
    listGroups.mockResolvedValue({ ok: true, groups: [{ id: 3, name: 'Depto', memberCount: 2, canCreateExpenses: true }] })
    const user = userEvent.setup()
    renderButton()

    await user.click(await openMenu(user))
    await user.click(screen.getByRole('menuitem', { name: 'Gasto grupal' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '¿En qué grupo?' })).toBeInTheDocument()

    await user.click(await screen.findByRole('link', { name: /Depto/ }))

    expect(screen.getByText('Nuevo gasto del grupo')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelar el selector vuelve sin navegar', async () => {
    listGroups.mockResolvedValue({ ok: true, groups: [] })
    const user = userEvent.setup()
    renderButton()

    await user.click(await openMenu(user))
    await user.click(screen.getByRole('menuitem', { name: 'Gasto grupal' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Nuevo gasto del grupo')).not.toBeInTheDocument()
  })
})

describe('QuickActionsButton: "Gasto con amigo" (027, US4)', () => {
  it('cierra el menú, pide el amigo y lleva a su formulario', async () => {
    listFriends.mockResolvedValue({
      ok: true,
      friends: [{ id: 15, firstName: 'Juan', lastName: 'Pérez', email: 'juan@example.com', avatarUrl: null }],
    })
    const user = userEvent.setup()
    renderButton()

    await user.click(await openMenu(user))
    await user.click(screen.getByRole('menuitem', { name: 'Gasto con amigo' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '¿Con qué amigo?' })).toBeInTheDocument()

    await user.click(await screen.findByRole('link', { name: /Juan Pérez/ }))

    expect(screen.getByText('Nuevo gasto con amigo')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
