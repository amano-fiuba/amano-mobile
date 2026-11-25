import { Link } from 'react-router'
import { expensePermissions } from '../../pages/groups/expensePermissions'
import GroupFeed from './GroupFeed'

export const NO_EXPENSES_MESSAGE = 'Todavía no hay gastos'

function countLabel(count) {
  if (!count) {
    return NO_EXPENSES_MESSAGE
  }
  return count === 1 ? '1 gasto registrado' : `${count} gastos registrados`
}

// "Gastos" section of the group screen (specs/017-debt-states, FR-021): number of
// expenses, the latest ones, "Nuevo gasto" when the role and the casillas allow
// it, and the history filtered by expenses. It uses the group the view already loaded and
// follows the layout of the "Miembros" section (redesign of PR #37).
export default function GroupExpensesCard({ groupId, group, reloadKey = 0 }) {
  const { canCreateExpenses } = expensePermissions(group)
  return (
    <section className="group-detail__section" aria-label="Gastos del grupo">
      <div className="group-detail__section-header">
        <h2>Gastos</h2>
        <div className="group-expenses__actions">
          <Link to={`/groups/${groupId}/recurring-expenses`} className="group-action">
            Gastos recurrentes
          </Link>
          {canCreateExpenses && (
            <Link to={`/groups/${groupId}/expenses/new`} className="group-action">
              Nuevo gasto
            </Link>
          )}
        </div>
      </div>
      <div className="group-expenses__summary">
        <p data-testid="group-expenses-count">{countLabel(group?.expensesCount)}</p>
      </div>
      {group?.expensesCount > 0 && (
        <GroupFeed
          groupId={groupId}
          eventTypes={['EXPENSE_CREATED']}
          emptyMessage={NO_EXPENSES_MESSAGE}
          reloadKey={reloadKey}
        />
      )}
      <div className="group-expenses__more">
        <Link to={`/groups/${groupId}/history?filter=EXPENSES`} className="group-expenses__history">
          Ver gastos en el historial
        </Link>
      </div>
    </section>
  )
}
