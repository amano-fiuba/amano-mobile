import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  getActivity: vi.fn(),
}))

const setUser = vi.fn()
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ setUser }),
}))

import { getActivity } from '../../api/groupsClient'
import GroupHistoryView, {
  HISTORY_ERROR_MESSAGE,
  NO_ACTIVITY_MESSAGE,
  NO_FILTERED_ACTIVITY_MESSAGE,
  NOT_A_MEMBER_MESSAGE,
} from './GroupHistoryView'

const ANA = { id: 7, firstName: 'Ana', lastName: 'López' }

function page(content, { totalPages = 1, page: number = 1 } = {}) {
  return { ok: true, content, totalElements: content.length, totalPages, page: number, size: 20 }
}

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/groups/42/history']}>
      <Routes>
        <Route path="/groups/:id/history" element={<GroupHistoryView groupId="42" />} />
        <Route path="/groups/:id" element={<p>Pantalla del grupo</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getActivity.mockReset()
  setUser.mockReset()
})

describe('GroupHistoryView (014)', () => {
  it('muestra frases completas agrupadas por día con la hora (US1)', async () => {
    getActivity.mockResolvedValue(page([
      {
        id: 3,
        eventType: 'MEMBER_REMOVED',
        actor: ANA,
        details: { type: 'REGISTERED', userId: 15, name: 'Juan Pérez' },
        createdAt: '2026-11-03T15:20:00Z',
      },
      {
        id: 2,
        eventType: 'MEMBER_ADDED',
        actor: ANA,
        details: { type: 'SIMULATED', name: 'Abuela' },
        createdAt: '2026-11-03T12:00:00Z',
      },
      {
        id: 1,
        eventType: 'MEMBER_ADDED',
        actor: null,
        details: { type: 'REGISTERED', name: 'Juan Pérez', atCreation: true },
        createdAt: '2026-10-20T13:00:00Z',
      },
    ]))

    renderView()

    const entries = await screen.findAllByTestId('activity-entry')
    expect(entries).toHaveLength(3)
    expect(entries[0]).toHaveTextContent('Ana López quitó a Juan Pérez del grupo')
    expect(entries[0]).toHaveTextContent('12:20')
    expect(entries[1]).toHaveTextContent('Ana López agregó el perfil simulado Abuela')
    expect(entries[2]).toHaveTextContent('Alguien agregó a Juan Pérez al crear el grupo')

    const days = screen.getAllByRole('heading', { level: 2 })
    expect(days).toHaveLength(2)
    expect(days[0]).toHaveTextContent(/3 de noviembre de 2026/)
    expect(days[1]).toHaveTextContent(/20 de octubre de 2026/)
    expect(within(screen.getByRole('region', { name: /3 de noviembre/ })).getAllByTestId('activity-entry'))
      .toHaveLength(2)

    expect(getActivity).toHaveBeenCalledWith('42', { page: 1, size: 20, eventTypes: [] })
    expect(screen.queryByText(/se registrarán cuando exista la integración/i)).not.toBeInTheDocument()
  })

  it('muestra gastos y pagos (US2)', async () => {
    getActivity.mockResolvedValue(page([
      {
        id: 2,
        eventType: 'PAYMENT_MADE',
        actor: ANA,
        details: { amount: '500', currency: 'ARS', fromName: 'Juan', toName: 'Ana' },
        createdAt: '2026-11-03T15:00:00Z',
      },
      {
        id: 1,
        eventType: 'EXPENSE_CREATED',
        actor: ANA,
        details: { amount: '1500.00', currency: 'ARS', description: 'Súper' },
        createdAt: '2026-11-03T14:00:00Z',
      },
    ]))

    renderView()

    const entries = await screen.findAllByTestId('activity-entry')
    expect(entries[0].textContent).toMatch(/Ana López registró un pago de \$\s?500,00 de Juan a Ana/)
    expect(entries[1].textContent).toMatch(/Ana López registró un gasto de \$\s?1\.500,00 «Súper»/)
  })

  it('avisa cuando todavía no hay actividad (US3)', async () => {
    getActivity.mockResolvedValue({ ok: true, totalPages: 0 })

    renderView()

    expect(await screen.findByText(NO_ACTIVITY_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /Paginación/ })).not.toBeInTheDocument()
  })

  it('filtra por tipo, vuelve a la página 1 y avisa si el filtro no tiene resultados (US3)', async () => {
    const user = userEvent.setup()
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: 100 - index,
      eventType: 'MEMBER_LEFT',
      actor: ANA,
      details: {},
      createdAt: '2026-11-03T15:00:00Z',
    }))
    getActivity
      .mockResolvedValueOnce(page(many, { totalPages: 3 }))
      .mockResolvedValueOnce(page(many, { totalPages: 3, page: 2 }))
      .mockResolvedValueOnce(page([], { totalPages: 0 }))

    renderView()
    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    expect(getActivity).toHaveBeenLastCalledWith('42', { page: 2, size: 20, eventTypes: [] })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mostrar' }), 'Bajas')

    expect(await screen.findByText(NO_FILTERED_ACTIVITY_MESSAGE)).toBeInTheDocument()
    expect(getActivity).toHaveBeenLastCalledWith('42', {
      page: 1, size: 20, eventTypes: ['MEMBER_REMOVED', 'MEMBER_LEFT'],
    })
  })

  it('pagina hacia atrás', async () => {
    const user = userEvent.setup()
    const entry = { id: 1, eventType: 'MEMBER_LEFT', actor: ANA, details: {}, createdAt: '2026-11-03T15:00:00Z' }
    getActivity
      .mockResolvedValueOnce(page([entry], { totalPages: 2 }))
      .mockResolvedValueOnce(page([entry], { totalPages: 2, page: 2 }))
      .mockResolvedValueOnce(page([entry], { totalPages: 2 }))

    renderView()
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument()
    expect(getActivity).toHaveBeenLastCalledWith('42', { page: 1, size: 20, eventTypes: [] })
  })

  it('ante un error de red muestra el mensaje con reintento y sin entradas viejas (US3)', async () => {
    const user = userEvent.setup()
    getActivity
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce(page([
        { id: 1, eventType: 'MEMBER_LEFT', actor: ANA, details: {}, createdAt: '2026-11-03T15:00:00Z' },
      ]))

    renderView()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(HISTORY_ERROR_MESSAGE)
    expect(screen.queryByTestId('activity-entry')).not.toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByTestId('activity-entry')).toHaveTextContent('Ana López abandonó el grupo')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ante 404 informa que no existe el grupo o no sos miembro, sin reintento', async () => {
    getActivity.mockResolvedValue({ ok: false, status: 404 })

    renderView()

    const alert = await screen.findByTestId('history-error')
    expect(alert).toHaveTextContent(NOT_A_MEMBER_MESSAGE)
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('ante 401 cierra la sesión local', async () => {
    getActivity.mockResolvedValue({ ok: false, status: 401 })

    renderView()

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })

  it('una respuesta vieja no pisa a la más reciente', async () => {
    const user = userEvent.setup()
    let resolveFirst
    getActivity
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(page([
        { id: 2, eventType: 'PHOTO_CHANGED', actor: ANA, details: {}, createdAt: '2026-11-03T15:00:00Z' },
      ]))

    renderView()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mostrar' }), 'Cambios del grupo')
    expect(await screen.findByTestId('activity-entry')).toHaveTextContent('cambió la foto del grupo')

    resolveFirst(page([
      { id: 1, eventType: 'MEMBER_LEFT', actor: ANA, details: {}, createdAt: '2026-11-03T15:00:00Z' },
    ]))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getAllByTestId('activity-entry')).toHaveLength(1)
    expect(screen.queryByText(/abandonó el grupo/)).not.toBeInTheDocument()
  })

  it('"Volver al grupo" lleva a la pantalla del grupo', async () => {
    const user = userEvent.setup()
    getActivity.mockResolvedValue(page([]))

    renderView()
    await user.click(screen.getByRole('link', { name: 'Volver al grupo' }))

    expect(await screen.findByText('Pantalla del grupo')).toBeInTheDocument()
  })

  it('"Ver gasto" también aparece en los pagos que traen expenseId (018 FR-022)', async () => {
    getActivity.mockResolvedValue(page([
      {
        id: 3,
        eventType: 'PAYMENT_MADE',
        actor: ANA,
        details: { paymentId: 54, amount: '1000.00', currency: 'ARS', fromName: 'Juan', toName: 'Ana', expenseId: 12, debtId: 31 },
        createdAt: '2026-11-03T16:00:00Z',
      },
      {
        id: 2,
        eventType: 'PAYMENT_MADE',
        actor: ANA,
        details: { paymentId: 3, amount: '500.00', currency: 'ARS', fromName: 'Juan', toName: 'Ana' },
        createdAt: '2026-11-03T15:00:00Z',
      },
    ]))

    renderView()

    const entries = await screen.findAllByTestId('activity-entry')
    expect(entries[0]).toHaveTextContent('registró un pago de')
    expect(within(entries[0]).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/42/expenses/12')
    expect(within(entries[1]).queryByRole('link', { name: 'Ver gasto' })).not.toBeInTheDocument()
  })

  it('los eventos de recordatorios enlazan al detalle del gasto (025 T033)', async () => {
    getActivity.mockResolvedValue(page([
      {
        id: 2,
        eventType: 'DEBT_REMINDER_SENT',
        actor: null,
        details: { reminderId: 1, debtId: 4, expenseId: 12, amount: '500.00', currency: 'ARS', fromName: 'Juan' },
        createdAt: '2026-11-03T16:00:00Z',
      },
      {
        id: 1,
        eventType: 'PAYER_DUE_NOTICE_SENT',
        actor: null,
        details: { reminderId: 2, expenseId: 13, payerName: 'Ana', concept: 'Súper' },
        createdAt: '2026-11-03T15:00:00Z',
      },
    ]))

    renderView()

    const entries = await screen.findAllByTestId('activity-entry')
    expect(within(entries[0]).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/42/expenses/12')
    expect(within(entries[1]).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/42/expenses/13')
  })

  it('"Ver gasto" enlaza al detalle solo cuando la entrada trae expenseId (017 FR-024)', async () => {    getActivity.mockResolvedValue(page([
      {
        id: 2,
        eventType: 'EXPENSE_CREATED',
        actor: ANA,
        details: { expenseId: 12, amount: '1500.00', currency: 'ARS', description: 'Súper' },
        createdAt: '2026-11-03T15:00:00Z',
      },
      {
        id: 1,
        eventType: 'EXPENSE_CREATED',
        actor: ANA,
        details: { amount: '10.00', currency: 'ARS' },
        createdAt: '2026-11-03T14:00:00Z',
      },
    ]))

    renderView()

    const entries = await screen.findAllByTestId('activity-entry')
    expect(within(entries[0]).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/42/expenses/12')
    expect(within(entries[1]).queryByRole('link', { name: 'Ver gasto' })).not.toBeInTheDocument()
  })

  it('muestra edición y borrado de gastos; el borrado no enlaza ni los eventos del gasto borrado (022 T076)', async () => {
    getActivity.mockResolvedValue(page([
      { id: 5, eventType: 'EXPENSE_DELETED', actor: ANA, details: { expenseId: 12 }, createdAt: '2026-11-04T16:00:00Z' },
      { id: 4, eventType: 'EXPENSE_EDITED', actor: ANA, details: { expenseId: 12 }, createdAt: '2026-11-04T15:00:00Z' },
      { id: 3, eventType: 'EXPENSE_CREATED', actor: ANA, details: { expenseId: 12, amount: '10.00', currency: 'ARS' }, createdAt: '2026-11-04T14:00:00Z' },
      { id: 2, eventType: 'EXPENSE_EDITED', actor: ANA, details: { expenseId: 13 }, createdAt: '2026-11-04T13:00:00Z' },
    ]))

    renderView()

    const entries = await screen.findAllByTestId('activity-entry')
    expect(entries[0]).toHaveTextContent('eliminó un gasto')
    expect(entries[1]).toHaveTextContent('editó un gasto')
    for (const index of [0, 1, 2]) {
      expect(within(entries[index]).queryByRole('link', { name: 'Ver gasto' })).not.toBeInTheDocument()
    }
    expect(within(entries[3]).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/42/expenses/13')
  })

  it('un evento viejo sin los campos nuevos y un tipo desconocido no rompen la lista (022 T076)', async () => {
    getActivity.mockResolvedValue(page([
      { id: 3, eventType: 'DEBT_OVERDUE', actor: null, details: {}, createdAt: '2026-11-04T16:00:00Z' },
      { id: 2, eventType: 'TIPO_NUEVO', actor: ANA, details: null, createdAt: '2026-11-04T15:00:00Z' },
      { id: 1, eventType: 'EXPENSE_CREATED', actor: ANA, details: { amount: '10.00', currency: 'ARS' }, createdAt: '2026-11-04T14:00:00Z' },
    ]))

    renderView()

    const entries = await screen.findAllByTestId('activity-entry')
    expect(entries).toHaveLength(3)
    expect(entries[0]).toHaveTextContent('Sistema venció una deuda')
    expect(entries[1]).toHaveTextContent('realizó una acción en el grupo')
    expect(entries[2]).toHaveTextContent('registró un gasto')
  })

  it('?filter=EXPENSES abre el historial filtrado y un valor desconocido muestra todo (017 FR-024)', async () => {
    getActivity.mockResolvedValue(page([]))
    const { unmount } = render(
      <MemoryRouter initialEntries={['/groups/42/history?filter=EXPENSES']}>
        <Routes>
          <Route path="/groups/:id/history" element={<GroupHistoryView groupId="42" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText(NO_FILTERED_ACTIVITY_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Mostrar' })).toHaveValue('EXPENSES')
    expect(getActivity).toHaveBeenLastCalledWith('42', {
      page: 1,
      size: 20,
      eventTypes: ['EXPENSE_CREATED', 'EXPENSE_EDITED', 'EXPENSE_DELETED'],
    })
    unmount()

    render(
      <MemoryRouter initialEntries={['/groups/42/history?filter=CUALQUIERA']}>
        <Routes>
          <Route path="/groups/:id/history" element={<GroupHistoryView groupId="42" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText(NO_ACTIVITY_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Mostrar' })).toHaveValue('ALL')
  })

  it('cambiar el filtro actualiza el parámetro y volver a "Toda la actividad" lo quita (017)', async () => {
    const user = userEvent.setup()
    getActivity.mockResolvedValue(page([]))
    renderView()
    await screen.findByText(NO_ACTIVITY_MESSAGE)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mostrar' }), 'Gastos')
    expect(await screen.findByText(NO_FILTERED_ACTIVITY_MESSAGE)).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mostrar' }), 'Toda la actividad')
    expect(await screen.findByText(NO_ACTIVITY_MESSAGE)).toBeInTheDocument()
  })
})
