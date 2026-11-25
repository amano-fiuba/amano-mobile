import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listFriends, createFriendExpense, getExchangeQuote, setUser, showSnackbar } = vi.hoisted(() => ({
  listFriends: vi.fn(),
  createFriendExpense: vi.fn(),
  getExchangeQuote: vi.fn(),
  setUser: vi.fn(),
  showSnackbar: vi.fn(),
}))
vi.mock('../api/friendsClient', async (importOriginal) => ({ ...(await importOriginal()), listFriends }))
vi.mock('../api/groupExpensesClient', async (importOriginal) => ({ ...(await importOriginal()), createFriendExpense }))
vi.mock('../api/groupsClient', async (importOriginal) => ({ ...(await importOriginal()), getExchangeQuote }))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, firstName: 'Ana', lastName: 'López', currencies: ['ARS', 'USD'] },
    setUser,
  }),
}))
vi.mock('../components/Snackbar', () => ({ useSnackbar: () => showSnackbar }))

import FriendExpenseFormView from './FriendExpenseFormView'
import { NOT_A_FRIEND_MESSAGE, SHARED_LABEL } from './groups/GroupExpenseFormView'

// 027: "Guardar" opens the final summary; confirm it when it shows up (valid form).
async function saveForm(user, button = screen.getByRole('button', { name: 'Guardar' })) {
  await user.click(button)
  const confirm = await screen
    .findByRole('button', { name: 'Confirmar' }, { timeout: 200 })
    .catch(() => null)
  if (confirm) {
    await user.click(confirm)
  }
}

const JUAN = { id: 15, firstName: 'Juan', lastName: 'Pérez', email: 'juan@example.com', avatarUrl: null }

function renderView(friendId = 15) {
  return render(
    <MemoryRouter initialEntries={[`/friends/${friendId}/expenses/new`]}>
      <Routes>
        <Route path="/friends/:friendId/expenses/new" element={<FriendExpenseFormView />} />
        <Route path="/" element={<p>Pantalla principal</p>} />
        <Route path="/friends" element={<p>Mis amigos</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillValid(user) {
  await user.type(await screen.findByLabelText('Monto'), '10000')
  await user.selectOptions(screen.getByLabelText('Categoría'), 'FOOD')
  await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'ONE_TIME')
  await user.selectOptions(screen.getByLabelText('Medio de pago'), 'DEBIT_CARD')
}

beforeEach(() => {
  listFriends.mockReset()
  createFriendExpense.mockReset()
  getExchangeQuote.mockReset()
  setUser.mockReset()
  showSnackbar.mockReset()
  listFriends.mockResolvedValue({ ok: true, friends: [JUAN] })
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('key-1')
})

describe('FriendExpenseFormView (027 US4)', () => {
  it('carga al amigo: los dos son los únicos participantes, fijos, y no hay "Gasto compartido"', async () => {
    renderView()

    expect(await screen.findByRole('heading', { name: 'Nuevo gasto con Juan Pérez' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: SHARED_LABEL })).not.toBeInTheDocument()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(2)
    boxes.forEach((box) => {
      expect(box).toBeChecked()
      expect(box).toBeDisabled()
    })
    const payer = screen.getByLabelText('¿Quién pagó?')
    expect(payer).toBeEnabled()
    expect(within(payer).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Ana López',
      'Juan Pérez',
    ])
    expect(screen.getByLabelText('Moneda')).toHaveValue('ARS')
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
  })

  it('envía el gasto al amigo, avisa y vuelve al inicio', async () => {
    const user = userEvent.setup()
    createFriendExpense.mockResolvedValue({ ok: true, expense: { id: 40 }, created: true })
    renderView()

    await fillValid(user)
    await user.selectOptions(screen.getByLabelText('¿Quién pagó?'), 'u:15')
    await saveForm(user)

    await waitFor(() => expect(createFriendExpense).toHaveBeenCalledTimes(1))
    const [friendId, payload, key] = createFriendExpense.mock.calls[0]
    expect(friendId).toBe('15')
    expect(key).toBe('key-1')
    expect(payload).toMatchObject({
      amount: '10000.00',
      currency: 'ARS',
      category: 'FOOD',
      type: 'ONE_TIME',
      paymentMethod: 'DEBIT_CARD',
      payerUserId: 15,
      splitMethod: 'EQUAL',
      participants: [
        { type: 'REGISTERED', userId: 7 },
        { type: 'REGISTERED', userId: 15 },
      ],
    })
    expect(showSnackbar).toHaveBeenCalledWith('Gasto registrado con Juan Pérez')
    expect(screen.getByText('Pantalla principal')).toBeInTheDocument()
  })

  it('en otra moneda no pide cotización (FR-034)', async () => {
    const user = userEvent.setup()
    renderView()
    await fillValid(user)

    await user.selectOptions(screen.getByLabelText('Moneda'), 'USD')
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(getExchangeQuote).not.toHaveBeenCalled()
    expect(screen.getByTestId('quote-preview')).toBeEmptyDOMElement()
  })

  it('si deja de ser amigo antes de guardar, muestra el mensaje y no navega (FR-033)', async () => {
    const user = userEvent.setup()
    createFriendExpense.mockResolvedValue({ ok: false, status: 404, detail: NOT_A_FRIEND_MESSAGE })
    renderView()

    await fillValid(user)
    await saveForm(user)

    expect(await screen.findByTestId('group-expense-error')).toHaveTextContent(NOT_A_FRIEND_MESSAGE)
    expect(screen.queryByText('Pantalla principal')).not.toBeInTheDocument()
  })

  it('un id que no es amigo muestra el error con acceso a la lista de amigos', async () => {
    renderView(99)

    expect(await screen.findByTestId('group-expense-load-error')).toHaveTextContent(NOT_A_FRIEND_MESSAGE)
    expect(screen.getByRole('link', { name: 'Ver mis amigos' })).toHaveAttribute('href', '/friends')
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
  })

  it('un error de red al cargar permite reintentar; un 401 cierra la sesión', async () => {
    listFriends.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderView()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('Monto')).toBeInTheDocument()

    listFriends.mockResolvedValueOnce({ ok: false, status: 401 })
    renderView()
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })

  it('un 404 al cargar la lista no es reintentable', async () => {
    listFriends.mockResolvedValueOnce({ ok: false, status: 404 })
    renderView()

    expect(await screen.findByTestId('group-expense-load-error')).toHaveTextContent(NOT_A_FRIEND_MESSAGE)
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('"Cancelar" vuelve al inicio sin crear nada', async () => {
    const user = userEvent.setup()
    renderView()
    await screen.findByLabelText('Monto')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByText('Pantalla principal')).toBeInTheDocument()
    expect(createFriendExpense).not.toHaveBeenCalled()
  })

  it('el resumen muestra con quién se comparte y la parte de cada uno', async () => {
    const user = userEvent.setup()
    renderView()
    await fillValid(user)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const summary = within(await screen.findByRole('dialog', { name: 'Confirmá el gasto' }))
    expect(summary.getByText('Con').nextSibling).toHaveTextContent('Juan Pérez')
    expect(within(summary.getByRole('list', { name: 'Parte de cada uno' })).getAllByRole('listitem')
      .map((item) => item.textContent)).toEqual(['Ana López$ 5.000,00 ARS', 'Juan Pérez$ 5.000,00 ARS'])
    expect(createFriendExpense).not.toHaveBeenCalled()
  })
})
