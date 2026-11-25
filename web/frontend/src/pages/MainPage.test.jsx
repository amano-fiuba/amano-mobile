import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MainPage from './MainPage'

const { useAuth, setUser, listGroups, listRecentExpenses, searchIncomes, listReceived, respond } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  setUser: vi.fn(),
  listGroups: vi.fn(),
  listRecentExpenses: vi.fn(),
  searchIncomes: vi.fn(),
  listReceived: vi.fn(),
  respond: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({ useAuth }))
vi.mock('../api/groupsClient', () => ({
  GROUPS_NETWORK_ERROR_MESSAGE: 'Error de grupos',
  listGroups,
}))
vi.mock('../api/incomeClient', () => ({
  BALANCE_ERROR_MESSAGE: 'Error de balance',
  searchIncomes,
  getBalance: vi.fn().mockResolvedValue({
    ok: true,
    balance: { currency: 'ARS', income: '1500.00', expenses: '400.00', net: '1100.00' },
  }),
}))
vi.mock('../api/expenseClient', () => ({
  RECENT_EXPENSES_ERROR_MESSAGE: 'Error de gastos',
  listRecentExpenses,
}))
vi.mock('../api/friendsClient', () => ({
  RECEIVED_NETWORK_ERROR_MESSAGE: 'Error de solicitudes',
  RESPOND_NETWORK_ERROR_MESSAGE: 'Error al responder',
  listReceivedFriendshipRequests: listReceived,
  respondFriendshipRequest: respond,
}))

const USER = {
  id: 7,
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
  cbuCvu: '0000003100010000000001',
  currencies: ['ARS', 'USD'],
  hasCustomAvatar: true,
  avatarUrl: '/api/users/7/avatar',
}

function group(id, lastActivityAt, extra = {}) {
  return { id, name: `Grupo ${id}`, memberCount: 2, lastActivityAt, ...extra }
}

const REQUEST = {
  id: 1,
  sender: { firstName: 'Juan', lastName: null, email: 'juan@example.com' },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MainPage />
    </MemoryRouter>,
  )
}

const section = (name) => screen.getByRole('region', { name })

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: USER, setUser })
  listGroups.mockResolvedValue({ ok: true, groups: [] })
  listRecentExpenses.mockResolvedValue({ ok: true, expenses: [] })
  searchIncomes.mockResolvedValue({ ok: true, incomes: [] })
  listReceived.mockResolvedValue({ ok: true, requests: [] })
})

describe('MainPage: balance del mes', () => {
  it('muestra la tarjeta de balance inmediatamente debajo del perfil', async () => {
    renderPage()

    const profile = section('Ana Pérez')
    const card = await screen.findByRole('region', { name: /^Balance de / })
    expect(profile.nextElementSibling).toBe(card)
    await waitFor(() => expect(within(card).getByTestId('monthly-income')).toHaveTextContent('+1.500,00 ARS'))
    expect(within(card).getByTestId('monthly-expenses')).toHaveTextContent('-400,00 ARS')
    expect(within(card).getByTestId('monthly-net')).toHaveTextContent('+1.100,00 ARS')
  })
})

describe('MainPage (015, US1)', () => {
  it('resume foto, nombre, CBU, monedas y correo', async () => {
    renderPage()

    const profile = section('Ana Pérez')
    expect(within(profile).getByText('ana@example.com')).toBeInTheDocument()
    expect(within(profile).getByText('0000003100010000000001')).toBeInTheDocument()
    expect(within(profile).getByText('ARS, USD')).toBeInTheDocument()
    expect(profile.querySelector('img')).toHaveAttribute('src', USER.avatarUrl)
    expect(within(profile).getByRole('link', { name: 'Ver perfil' })).toHaveAttribute('href', '/profile')
    await screen.findByText('Todavía no sos miembro de ningún grupo')
  })

  it('copia el CBU/CVU desde la tarjeta de perfil', async () => {
    const user = userEvent.setup()
    // Después de setup(): userEvent instala su propio navigator.clipboard.
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    renderPage()

    const profile = section('Ana Pérez')
    await user.click(within(profile).getByRole('button', { name: 'Copiar CBU/CVU' }))

    expect(writeText).toHaveBeenCalledWith(USER.cbuCvu)
    expect(await within(profile).findByText('¡Copiado!')).toBeInTheDocument()
    delete navigator.clipboard
  })

  it('aplica los valores por defecto del perfil', async () => {
    useAuth.mockReturnValue({
      user: { id: 7, firstName: 'Ana', lastName: null, email: 'a@b.c', currencies: [] },
      setUser,
    })
    renderPage()

    const profile = section('Ana')
    expect(within(profile).getByText('No informado')).toBeInTheDocument()
    expect(within(profile).queryByRole('button', { name: 'Copiar CBU/CVU' })).not.toBeInTheDocument()
    expect(within(profile).getByText('ARS')).toBeInTheDocument()
    expect(profile.querySelector('img')).toHaveAttribute('src', '/avatar-default.png')
    await screen.findByText('Todavía no registraste gastos ni ingresos')
  })

  it('muestra los 5 grupos de actividad más reciente, primero el último', async () => {
    listGroups.mockResolvedValue({
      ok: true,
      groups: [
        group(1, '2026-01-01T10:00:00Z'),
        group(2, '2026-06-01T10:00:00Z', { memberCount: 1 }),
        group(3, '2026-03-01T10:00:00Z', { photo: '/foto.png' }),
        group(4, '2026-04-01T10:00:00Z'),
        group(5, '2026-05-01T10:00:00Z'),
        group(6, '2026-02-01T10:00:00Z'),
      ],
    })
    renderPage()

    const links = await within(section('Grupos')).findAllByRole('link', { name: /^grupo/i })
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/groups/2',
      '/groups/5',
      '/groups/4',
      '/groups/3',
      '/groups/6',
    ])
    expect(within(links[0]).getByText(/^1 miembro/)).toBeInTheDocument()
    expect(links[3].querySelector('img')).toHaveAttribute('src', '/foto.png')
    expect(screen.getByRole('link', { name: 'Ir a Grupos' })).toHaveAttribute('href', '/groups')
  })

  it('muestra los últimos gastos con descripción o categoría', async () => {
    listRecentExpenses.mockResolvedValue({
      ok: true,
      expenses: [
        { id: 1, description: 'Alquiler', category: 'HOUSING', amount: '250000.00', currency: 'ARS', date: '2026-11-01' },
        { id: 2, category: 'FOOD', amount: '12.50', currency: 'USD', date: '2026-10-30' },
      ],
    })
    renderPage()

    const activity = section('Actividad personal')
    expect(await within(activity).findByText('Alquiler')).toBeInTheDocument()
    expect(within(activity).getByText('ARS 250.000,00')).toBeInTheDocument()
    expect(within(activity).getByText('01/11/2026')).toBeInTheDocument()
    expect(within(activity).getByText('Alimentos')).toBeInTheDocument()
  })

  it('mezcla gastos e ingresos recientes del más nuevo al más viejo y enlaza cada detalle', async () => {
    listRecentExpenses.mockResolvedValue({
      ok: true,
      expenses: [
        { id: 1, description: 'Alquiler', category: 'HOUSING', amount: '250000.00', currency: 'ARS', date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' },
        { id: 2, description: 'Café', category: 'FOOD', amount: '12.50', currency: 'ARS', date: '2026-11-10', createdAt: '2026-11-10T08:00:00Z' },
      ],
    })
    searchIncomes.mockResolvedValue({
      ok: true,
      incomes: [
        { id: 9, category: 'SALARY', amount: '900000.00', currency: 'ARS', date: '2026-11-10', createdAt: '2026-11-10T09:00:00Z' },
        { id: 8, description: 'Venta bici', category: 'SALE', amount: '50.00', currency: 'USD', date: '2026-10-20', createdAt: '2026-10-20T09:00:00Z' },
      ],
    })
    renderPage()

    const activity = section('Actividad personal')
    await within(activity).findByText('Sueldo')
    const rows = within(activity).getAllByRole('listitem')
    expect(rows.map((row) => row.querySelector('strong').textContent)).toEqual([
      'Sueldo',
      'Café',
      'Alquiler',
      'Venta bici',
    ])
    expect(searchIncomes).toHaveBeenCalledWith({ size: 5 })
    const links = within(activity).getAllByRole('link').filter((link) => link.dataset.kind)
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/incomes/9',
      '/expenses/2',
      '/expenses/1',
      '/incomes/8',
    ])
    const income = within(rows[0]).getByTestId('movement-income-amount')
    expect(income).toHaveClass('main-expense__amount--income')
    expect(income).toHaveTextContent(/^ARS 900\.000,00$/)
    const expense = within(rows[1]).getByTestId('movement-expense-amount')
    expect(expense).toHaveClass('main-expense__amount--expense')
    expect(expense).toHaveTextContent(/^ARS 12,50$/)
    expect(within(rows[1]).queryByTestId('movement-income-amount')).not.toBeInTheDocument()
  })

  it('si fallan los ingresos igual muestra los gastos, y si fallan ambos informa el error', async () => {
    listRecentExpenses.mockResolvedValue({
      ok: true,
      expenses: [{ id: 1, description: 'Alquiler', category: 'HOUSING', amount: '1.00', currency: 'ARS', date: '2026-11-01' }],
    })
    searchIncomes.mockResolvedValue({ ok: false, network: true })
    const { unmount } = renderPage()
    expect(await within(section('Actividad personal')).findByText('Alquiler')).toBeInTheDocument()
    unmount()

    listRecentExpenses.mockResolvedValue({ ok: false, network: true })
    renderPage()
    expect(await screen.findByText('Error de gastos')).toBeInTheDocument()
  })

  it('un error queda dentro de su sección', async () => {
    listGroups.mockResolvedValue({ ok: false, network: true })
    listRecentExpenses.mockResolvedValue({ ok: false, network: true })
    searchIncomes.mockResolvedValue({ ok: false, network: true })
    listReceived.mockResolvedValue({ ok: false, network: true })
    renderPage()

    expect(await screen.findByText('Error de grupos')).toBeInTheDocument()
    expect(await screen.findByText('Error de gastos')).toBeInTheDocument()
    expect(await screen.findByText('Error de solicitudes')).toBeInTheDocument()
    expect(section('Ana Pérez')).toBeInTheDocument()
    expect(setUser).not.toHaveBeenCalled()
  })

  it('un 401 cierra la sesión', async () => {
    listGroups.mockResolvedValue({ ok: false, status: 401 })
    renderPage()

    await vi.waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })

  it('acepta una solicitud y la saca de la lista', async () => {
    listReceived.mockResolvedValue({ ok: true, requests: [REQUEST] })
    respond.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Aceptar a Juan' }))

    expect(respond).toHaveBeenCalledWith(1, 'ACCEPT')
    expect(await screen.findByText('No tenés solicitudes pendientes')).toBeInTheDocument()
    expect(screen.getByTestId('snackbar')).toHaveTextContent('Solicitud de amistad aceptada')
  })

  it('ante un fallo de red conserva la solicitud y avisa', async () => {
    listReceived.mockResolvedValue({ ok: true, requests: [REQUEST] })
    respond.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Rechazar a Juan' }))

    expect(respond).toHaveBeenCalledWith(1, 'REJECT')
    expect(await screen.findByRole('alert')).toHaveTextContent('Error al responder')
    expect(screen.getByRole('button', { name: 'Aceptar a Juan' })).toBeEnabled()
  })

  it('con 409 saca la solicitud y muestra el motivo', async () => {
    listReceived.mockResolvedValue({ ok: true, requests: [REQUEST] })
    respond.mockResolvedValue({ ok: false, status: 409, detail: 'Ya fue respondida' })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Aceptar a Juan' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya fue respondida')
    expect(screen.queryByRole('button', { name: 'Aceptar a Juan' })).not.toBeInTheDocument()
  })

  it('un 401 al responder cierra la sesión', async () => {
    listReceived.mockResolvedValue({ ok: true, requests: [REQUEST] })
    respond.mockResolvedValue({ ok: false, status: 401 })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Aceptar a Juan' }))

    expect(setUser).toHaveBeenCalledWith(null)
  })

  it('muestra hasta 3 solicitudes y ofrece ver todas', async () => {
    listReceived.mockResolvedValue({
      ok: true,
      requests: [1, 2, 3, 4].map((id) => ({
        id,
        sender: { firstName: `Persona${id}`, lastName: 'Gómez', email: `p${id}@example.com` },
      })),
    })
    renderPage()

    const requests = section('Solicitudes de amistad')
    expect(await within(requests).findByText('Persona3 Gómez')).toBeInTheDocument()
    expect(within(requests).queryByText('Persona4 Gómez')).not.toBeInTheDocument()
    expect(within(requests).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/friends')
  })
})
