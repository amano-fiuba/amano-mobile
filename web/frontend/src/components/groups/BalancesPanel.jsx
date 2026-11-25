import { useCallback } from 'react'
import { getGroupBalances } from '../../api/groupExpensesClient'
import { formatAmount } from '../../validation/expenseFormat'
import { moneySign, moneyText } from '../../pages/groups/debtMoney'
import useGroupResource from '../../pages/groups/useGroupResource'
import ResourceState from './ResourceState'

export const NO_BALANCES_MESSAGE = 'Todavía no hay saldos en este grupo'

function standing(balance) {
  const sign = moneySign(balance)
  const amount = `$ ${formatAmount(moneyText(balance) ?? '0.00')}`
  if (sign > 0) return `A favor ${amount}`
  if (sign < 0) return `Debe ${amount}`
  return 'Al día'
}

// "Saldos" tab: net balance of every member, one list per currency (amounts in
// different currencies are never added together). The server guarantees that
// the balances of a currency add up to zero.
export default function BalancesPanel({ groupId, refreshKey }) {
  const loader = useCallback(() => getGroupBalances(groupId), [groupId])
  const resource = useGroupResource(loader, refreshKey)
  const currencies = Array.isArray(resource.data?.currencies) ? resource.data.currencies : []

  return (
    <ResourceState resource={resource} isEmpty={currencies.length === 0} emptyMessage={NO_BALANCES_MESSAGE}>
      {currencies.map((entry) => (
        <section key={entry.currency} className="group-card" aria-label={`Saldos en ${entry.currency}`}>
          <h3>Saldos en {entry.currency}</h3>
          <ul className="group-debts__list">
            {(entry.balances ?? []).map((member) => (
              <li key={`${member.memberType}-${member.memberId}`} data-testid="balance-row">
                <span>
                  {member.memberName}
                  {member.memberType === 'SIMULATED' && ' (perfil simulado)'}
                </span>
                <strong>{standing(member.netBalance)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ResourceState>
  )
}
