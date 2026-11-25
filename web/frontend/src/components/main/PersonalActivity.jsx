import { Link } from 'react-router'
import { RECENT_EXPENSES_ERROR_MESSAGE, listRecentExpenses } from '../../api/expenseClient'
import { searchIncomes } from '../../api/incomeClient'
import { useSessionData } from '../../hooks/useSessionData'
import {
  CATEGORY_OPTIONS,
  INCOME_CATEGORY_OPTIONS,
  labelOf,
} from '../../validation/expenseCatalog'
import { formatAmount, formatIsoDate } from '../../validation/expenseFormat'

// Latest personal movements (specs/015-main-screen FR-008, extended by
// specs/033-income-management): the recent expenses and incomes together, newest
// first. Income amounts are shown in green and expense amounts in red.
const RECENT_LIMIT = 5

/** Newest first: date, then registration moment, then id. */
function byNewest(a, b) {
  return (
    b.date.localeCompare(a.date) ||
    String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')) ||
    Number(b.id) - Number(a.id)
  )
}

/**
 * Loads both lists and merges them. A 401 in either one closes the session; if only
 * one list fails the other is still shown; both failing is an error.
 */
async function loadRecentMovements() {
  const [expenses, incomes] = await Promise.all([
    listRecentExpenses(),
    searchIncomes({ size: RECENT_LIMIT }),
  ])
  const unauthorized = [expenses, incomes].find((result) => result.status === 401)
  if (unauthorized) {
    return { ok: false, status: 401 }
  }
  if (!expenses.ok && !incomes.ok) {
    return { ok: false, network: true }
  }
  const movements = [
    ...(expenses.ok ? expenses.expenses.map((item) => ({ ...item, kind: 'expense' })) : []),
    ...(incomes.ok ? incomes.incomes.map((item) => ({ ...item, kind: 'income' })) : []),
  ]
  return { ok: true, movements: movements.sort(byNewest).slice(0, RECENT_LIMIT) }
}

function Movement({ movement }) {
  const income = movement.kind === 'income'
  const label =
    movement.description ||
    labelOf(income ? INCOME_CATEGORY_OPTIONS : CATEGORY_OPTIONS, movement.category)
  return (
    <li>
      <Link
        to={income ? `/incomes/${movement.id}` : `/expenses/${movement.id}`}
        className="main-expense"
        data-kind={movement.kind}
      >
        <span>
          <strong>{label}</strong>
          <small>
            {formatIsoDate(movement.date)}
          </small>
        </span>
        <span
          className={`main-expense__amount main-expense__amount--${income ? 'income' : 'expense'}`}
          data-testid={`movement-${movement.kind}-amount`}
        >
          {movement.currency} {formatAmount(movement.amount)}
        </span>
      </Link>
    </li>
  )
}

export default function PersonalActivity() {
  const [{ status, items }] = useSessionData(loadRecentMovements, 'movements')

  return (
    <section className="main-card" aria-labelledby="main-activity-title">
      <div className="main-card__header">
        <h2 id="main-activity-title">Actividad personal</h2>
        <Link to="/activity">Ver todo</Link>
      </div>

      {status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {status === 'error' && <p role="alert">{RECENT_EXPENSES_ERROR_MESSAGE}</p>}
      {status === 'ready' && items.length === 0 && (
        <p>Todavía no registraste gastos ni ingresos</p>
      )}
      {items.length > 0 && (
        <ul className="main-list">
          {items.map((movement) => (
            <Movement key={`${movement.kind}-${movement.id}`} movement={movement} />
          ))}
        </ul>
      )}
    </section>
  )
}
