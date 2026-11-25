import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { EXPENSE_DETAIL_ERROR_MESSAGE, getExpense } from '../api/expenseClient'
import { useAuth } from '../auth/AuthContext'
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  labelOf,
} from '../validation/expenseCatalog'
import { formatAmount, formatIsoDate } from '../validation/expenseFormat'
import './MainPage.scss'

// Exact messages of specs/031-buscar-en-actividad-personal, exported for the tests.
export const NOT_FOUND_MESSAGE = 'No encontramos ese gasto'
export const NO_DESCRIPTION_LABEL = 'Sin descripción'

/**
 * "Volver" goes back to the activity with the search in force (FR-015): the row
 * passes its address in `state.from`; a direct visit falls back to /activity.
 */
function backTarget(state) {
  const from = state?.from
  return typeof from === 'string' && from.startsWith('/activity') ? from : '/activity'
}

function ExpenseDetail({ expense }) {
  const isRecurring = Boolean(expense.frequency)
  return (
    <section className="main-card expense-detail" data-testid="expense-detail">
      <p className="expense-detail__amount">
        {expense.currency} {formatAmount(expense.amount)}
      </p>
      {Array.isArray(expense.conversions) && expense.conversions.length > 0 && (
        <ul className="expense-detail__conversions" aria-label="Equivalencias">
          {expense.conversions.map((conversion) => (
            <li key={conversion.currency}>
              ≈ {conversion.currency} {formatAmount(conversion.amount)}
            </li>
          ))}
        </ul>
      )}
      <dl className="expense-detail__data">
        <dt>Fecha</dt>
        <dd>{formatIsoDate(expense.date)}</dd>
        <dt>Categoría</dt>
        <dd>{labelOf(CATEGORY_OPTIONS, expense.category)}</dd>
        <dt>Medio de pago</dt>
        <dd>{labelOf(PAYMENT_METHOD_OPTIONS, expense.paymentMethod)}</dd>
        <dt>Tipo</dt>
        <dd>{labelOf(TYPE_OPTIONS, expense.type)}</dd>
        <dt>Descripción</dt>
        <dd>{expense.description || NO_DESCRIPTION_LABEL}</dd>
        {isRecurring && (
          <>
            <dt>Frecuencia</dt>
            <dd>{labelOf(FREQUENCY_OPTIONS, expense.frequency)}</dd>
            <dt>Estado</dt>
            <dd>{labelOf(STATUS_OPTIONS, expense.status)}</dd>
            {expense.status === 'ACTIVE' && expense.nextOccurrenceDate && (
              <>
                <dt>Próxima fecha</dt>
                <dd>{formatIsoDate(expense.nextOccurrenceDate)}</dd>
              </>
            )}
          </>
        )}
      </dl>
    </section>
  )
}

// Detalle de un gasto personal (specs/031-buscar-en-actividad-personal, US3).
export default function ExpenseDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { setUser } = useAuth()
  const [state, setState] = useState({ status: 'loading', expense: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getExpense(id).then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setState({ status: 'ready', expense: result.expense })
      } else if (result.status === 401) {
        setUser(null)
      } else if (result.status === 404 || result.status === 400) {
        setState({ status: 'not-found', expense: null })
      } else {
        setState({ status: 'error', expense: null })
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, attempt, setUser])

  const retry = () => {
    setState({ status: 'loading', expense: null })
    setAttempt((value) => value + 1)
  }

  const back = backTarget(location.state)
  const title =
    state.expense?.description ||
    labelOf(CATEGORY_OPTIONS, state.expense?.category) ||
    'Detalle del gasto'

  return (
    <main className="page">
      <Link className="home-link" to={back}>
        <span aria-hidden="true">←</span> Volver
      </Link>
      <h1>{title}</h1>

      {state.status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {state.status === 'not-found' && <p role="alert">{NOT_FOUND_MESSAGE}</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>{EXPENSE_DETAIL_ERROR_MESSAGE}</p>
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}
      {state.status === 'ready' && <ExpenseDetail expense={state.expense} />}
    </main>
  )
}
