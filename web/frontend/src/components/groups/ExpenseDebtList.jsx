import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { isPayableDebtStatus } from '../../pages/groups/debtStatusLabels'
import DebtStatusBadge from './DebtStatusBadge'
import { formatAmount } from '../../validation/expenseFormat'
import WhistleButton from './WhistleButton'

export const NO_DEBTS_MESSAGE = 'Este gasto no generó deudas'

// Debts of one group expense (specs/017-debt-states, FR-023): "{deudor} le debe
// a {acreedor}", the amount and the state. The backend already sends them in
// share order (contract §GET). With `groupId` and `expenseId`, each debt the
// session user may pay (`canRegisterPayment`, 018 FR-016/FR-017) links to the
// "Registrar pago" screen; without them the list stays read-only. 030: the session
// user also gets "Avisar" on the payable debts in which they are the creditor.
export default function ExpenseDebtList({ debts, groupId, expenseId, concept, onStale }) {
  const auth = useAuth()
  const currentUserId = auth?.user?.id ?? null
  const withActions = groupId != null && expenseId != null
  const list = Array.isArray(debts) ? debts : []
  if (list.length === 0) {
    return <p className="group-expense__empty">{NO_DEBTS_MESSAGE}</p>
  }
  return (
    <ul className="group-expense__debts" aria-label="Deudas del gasto">
      {list.map((debt) => (
        <li key={debt.id} className="group-expense__debt" data-testid="debt-row">
          <span className="group-expense__debt-who">
            {debt.debtor?.name ?? 'Alguien'} le debe a {debt.creditor?.name ?? 'alguien'}
          </span>
          <span className="group-expense__debt-amount">$ {formatAmount(debt.amount)}</span>
          <DebtStatusBadge status={debt.status} outstanding={debt.outstanding} />
          {withActions && debt.canRegisterPayment && (
            <Link
              className="group-action"
              to={`/groups/${groupId}/expenses/${expenseId}/debts/${debt.id}/payment`}
            >
              Registrar pago
            </Link>
          )}
          {withActions && currentUserId != null && debt.creditor?.userId === currentUserId
            && isPayableDebtStatus(debt.status) && (
            <WhistleButton
              groupId={groupId}
              debtId={debt.id}
              debtorName={debt.debtor?.name}
              amountText={`$ ${formatAmount(debt.outstanding)} ${debt.currency ?? ''}`.trim()}
              concept={concept}
              simulated={debt.debtor?.type === 'SIMULATED'}
              onStale={onStale}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
