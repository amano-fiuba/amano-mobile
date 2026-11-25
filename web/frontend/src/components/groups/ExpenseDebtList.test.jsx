import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7 }, setUser: vi.fn() }),
}))
import DebtStatusBadge from './DebtStatusBadge'
import ExpenseDebtList, { NO_DEBTS_MESSAGE } from './ExpenseDebtList'
import ExpenseSharePreview, {
  PREVIEW_EMPTY_MESSAGE,
  REST_IN_ORDER_NOTE,
  REST_TO_PAYER_NOTE,
} from './ExpenseSharePreview'
import GroupExpensesCard, { NO_EXPENSES_MESSAGE } from './GroupExpensesCard'
import { splitEqually } from '../../pages/groups/splitEqually'

// 017 T034/T035: reusable pieces of the group expense screens (plan.md
// §Componentes).

const ANA = { userId: 7, name: 'Ana López' }

function debt(id, name, status, outstanding = '3333.33') {
  return {
    id,
    debtor: { type: 'REGISTERED', userId: id, simulatedProfileId: null, name },
    creditor: ANA,
    amount: '3333.33',
    paidAmount: '0.00',
    outstanding,
    currency: 'ARS',
    status,
  }
}

describe('DebtStatusBadge (017)', () => {
  it.each([
    ['PENDING', '10.00', 'Pendiente', 'pending'],
    ['PARTIALLY_PAID', '1234.50', 'Pago parcial · faltan $ 1.234,50', 'partial'],
    ['PAID', '0.00', 'Pagada', 'paid'],
    ['RARE', '0.00', 'Estado desconocido', 'unknown'],
  ])('%s muestra su texto y su clase', (status, outstanding, text, modifier) => {
    render(<DebtStatusBadge status={status} outstanding={outstanding} />)
    const badge = screen.getByTestId('debt-status')
    expect(badge).toHaveTextContent(text)
    expect(badge).toHaveClass(`group-expense__status--${modifier}`)
  })
})

describe('ExpenseDebtList (017)', () => {
  it('muestra cada deuda en orden con deudor, acreedor, monto y estado', () => {
    render(
      <ExpenseDebtList
        debts={[
          debt(15, 'Juan Pérez', 'PENDING'),
          { ...debt(4, 'Abuela', 'PARTIALLY_PAID', '1000.00'), debtor: { type: 'SIMULATED', simulatedProfileId: null, name: 'Abuela' } },
          debt(16, 'Tío', 'PAID', '0.00'),
        ]}
      />,
    )
    const rows = screen.getAllByTestId('debt-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Juan Pérez le debe a Ana López')
    expect(rows[0]).toHaveTextContent('$ 3.333,33')
    expect(within(rows[0]).getByTestId('debt-status')).toHaveTextContent('Pendiente')
    expect(rows[1]).toHaveTextContent('Abuela le debe a Ana López')
    expect(within(rows[1]).getByTestId('debt-status')).toHaveTextContent('Pago parcial · faltan $ 1.000,00')
    expect(within(rows[2]).getByTestId('debt-status')).toHaveTextContent('Pagada')
  })

  it('tolera nombres ausentes', () => {
    render(<ExpenseDebtList debts={[{ id: 1, status: 'PENDING', amount: '1.00', outstanding: '1.00' }]} />)
    expect(screen.getByTestId('debt-row')).toHaveTextContent('Alguien le debe a alguien')
  })

  it('sin deudas muestra el mensaje vacío', () => {
    const { rerender } = render(<ExpenseDebtList debts={[]} />)
    expect(screen.getByText(NO_DEBTS_MESSAGE)).toBeInTheDocument()
    rerender(<ExpenseDebtList />)
    expect(screen.getByText(NO_DEBTS_MESSAGE)).toBeInTheDocument()
  })
})

describe('ExpenseDebtList con "Registrar pago" (018)', () => {
  function renderList(props) {
    return render(
      <MemoryRouter>
        <ExpenseDebtList {...props} />
      </MemoryRouter>,
    )
  }

  it('ofrece "Registrar pago" en cada deuda que la persona puede pagar', () => {
    renderList({
      groupId: '3',
      expenseId: '12',
      debts: [
        { ...debt(31, 'Juan Pérez', 'PENDING'), canRegisterPayment: true },
        { ...debt(32, 'Abuela', 'PENDING'), canRegisterPayment: false },
        { ...debt(33, 'Tío', 'PAID', '0.00'), canRegisterPayment: false },
      ],
    })
    const rows = screen.getAllByTestId('debt-row')
    expect(within(rows[0]).getByRole('link', { name: 'Registrar pago' }))
      .toHaveAttribute('href', '/groups/3/expenses/12/debts/31/payment')
    expect(within(rows[1]).queryByRole('link', { name: 'Registrar pago' })).not.toBeInTheDocument()
    expect(within(rows[2]).queryByRole('link', { name: 'Registrar pago' })).not.toBeInTheDocument()
  })

  it('sin groupId ni expenseId la lista sigue siendo de solo lectura', () => {
    renderList({ debts: [{ ...debt(31, 'Juan Pérez', 'PENDING'), canRegisterPayment: true }] })
    expect(screen.queryByRole('link', { name: 'Registrar pago' })).not.toBeInTheDocument()
  })
})

describe('ExpenseDebtList con "Avisar" (030 T012)', () => {
  function renderList(props) {
    return render(
      <MemoryRouter>
        <ExpenseDebtList groupId="3" expenseId="12" {...props} />
      </MemoryRouter>,
    )
  }
  const whistle = (row) => within(row).queryByRole('button', { name: /^Avisar a / })

  it('aparece en las deudas avisables cuyo acreedor es la persona de la sesión', () => {
    renderList({
      debts: [
        debt(31, 'Juan Pérez', 'PENDING'),
        debt(32, 'Carla', 'OVERDUE'),
        debt(33, 'Tío', 'PAID', '0.00'),
        debt(34, 'Primo', 'PAYMENT_REPORTED'),
        { ...debt(35, 'Ana López', 'PENDING'), creditor: { userId: 15, name: 'Juan Pérez' } },
        { ...debt(36, 'Abuela', 'PARTIALLY_PAID', '1000.00'), debtor: { type: 'SIMULATED', simulatedProfileId: 4, name: 'Abuela' } },
      ],
    })
    const rows = screen.getAllByTestId('debt-row')
    expect(whistle(rows[0])).toHaveAccessibleName('Avisar a Juan Pérez')
    expect(whistle(rows[1])).toBeEnabled()
    expect(whistle(rows[2])).not.toBeInTheDocument()
    expect(whistle(rows[3])).not.toBeInTheDocument()
    expect(whistle(rows[4])).not.toBeInTheDocument()
    expect(whistle(rows[5])).toBeDisabled()
  })

  it('sin groupId ni expenseId no ofrece avisar', () => {
    render(<MemoryRouter><ExpenseDebtList debts={[debt(31, 'Juan Pérez', 'PENDING')]} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /^Avisar a / })).not.toBeInTheDocument()
  })
})

describe('ExpenseSharePreview (017)', () => {
  const names = { 'u:7': 'Ana López', 'u:15': 'Juan Pérez', 's:4': 'Abuela' }

  it('marca al pagador y avisa que absorbe el resto', () => {
    const shares = splitEqually('10000.00', ['u:7', 'u:15', 's:4'], 'u:7')
    render(<ExpenseSharePreview shares={shares} names={names} payerKey="u:7" />)

    const rows = screen.getAllByTestId('share-preview-row')
    expect(rows[0]).toHaveTextContent('Ana López (pagó)')
    expect(rows[0]).toHaveTextContent('$ 3.333,34')
    expect(rows[1]).toHaveTextContent('Juan Pérez')
    expect(rows[1]).toHaveTextContent('$ 3.333,33')
    expect(screen.getByText(REST_TO_PAYER_NOTE)).toBeInTheDocument()
  })

  it('sin el pagador avisa que el resto va en orden', () => {
    const shares = splitEqually('100.00', ['u:15', 's:4', 's:9'], 'u:7')
    render(<ExpenseSharePreview shares={shares} names={names} payerKey="u:7" />)

    const rows = screen.getAllByTestId('share-preview-row')
    expect(rows[0]).toHaveTextContent('$ 33,34')
    expect(rows[2]).toHaveTextContent('s:9')
    expect(screen.getByText(REST_IN_ORDER_NOTE)).toBeInTheDocument()
  })

  it('una división exacta no muestra la nota', () => {
    render(<ExpenseSharePreview shares={splitEqually('10.00', ['u:7', 'u:15'], 'u:7')} names={names} payerKey="u:7" />)
    expect(screen.queryByText(REST_TO_PAYER_NOTE)).not.toBeInTheDocument()
  })

  it('sin división válida muestra la ayuda', () => {
    render(<ExpenseSharePreview shares={null} names={names} payerKey="u:7" />)
    expect(screen.getByText(PREVIEW_EMPTY_MESSAGE)).toBeInTheDocument()
  })
})

describe('GroupExpensesCard (017)', () => {
  function renderCard(group) {
    return render(
      <MemoryRouter>
        <GroupExpensesCard groupId="3" group={group} />
      </MemoryRouter>,
    )
  }

  it('cuenta los gastos y ofrece "Nuevo gasto" y el historial filtrado', () => {
    renderCard({ currentUserRole: 'ADMIN', expensesCount: 2, permissions: {} })
    expect(screen.getByTestId('group-expenses-count')).toHaveTextContent('2 gastos registrados')
    expect(screen.getByRole('link', { name: 'Nuevo gasto' })).toHaveAttribute('href', '/groups/3/expenses/new')
    expect(screen.getByRole('link', { name: 'Gastos recurrentes' }))
      .toHaveAttribute('href', '/groups/3/recurring-expenses')
    expect(screen.getByRole('link', { name: 'Ver gastos en el historial' }))
      .toHaveAttribute('href', '/groups/3/history?filter=EXPENSES')
  })

  it('usa singular con un gasto y el mensaje vacío sin gastos', () => {
    const { unmount } = renderCard({ currentUserRole: 'MEMBER', expensesCount: 1, permissions: {} })
    expect(screen.getByTestId('group-expenses-count')).toHaveTextContent('1 gasto registrado')
    unmount()
    renderCard({ currentUserRole: 'MEMBER', expensesCount: 0, permissions: {} })
    expect(screen.getByTestId('group-expenses-count')).toHaveTextContent(NO_EXPENSES_MESSAGE)
  })

  it('oculta "Nuevo gasto" a un MEMBER cuando el grupo no permite gastos', () => {
    renderCard({ currentUserRole: 'MEMBER', expensesCount: 0, permissions: { membersCannotMakeExpenses: true } })
    expect(screen.queryByRole('link', { name: 'Nuevo gasto' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver gastos en el historial' })).toBeInTheDocument()
  })
})
