import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { INCOME_DETAIL_ERROR_MESSAGE, getIncome } from '../api/incomeClient'
import { useAuth } from '../auth/AuthContext'
import {
  INCOME_CATEGORY_OPTIONS,
  INCOME_PAYMENT_METHOD_OPTIONS,
  labelOf,
} from '../validation/expenseCatalog'
import { formatAmount, formatIsoDate } from '../validation/expenseFormat'
import './MainPage.scss'

export const INCOME_NOT_FOUND_MESSAGE = 'No encontramos ese ingreso'
export const NO_DESCRIPTION_LABEL = 'Sin descripción'
export const PROJECTED_LABEL = 'Proyectado'

/**
 * "Volver" goes back to the activity with the search in force: the row passes its
 * address in `state.from`; a direct visit falls back to /activity (as the expense
 * detail does).
 */
function backTarget(state) {
  const from = state?.from
  return typeof from === 'string' && from.startsWith('/activity') ? from : '/activity'
}

function IncomeDetail({ income }) {
  return (
    <section className="main-card expense-detail" data-testid="income-detail">
      <p className="expense-detail__amount">
        {income.currency} {formatAmount(income.amount)}
      </p>
      {Array.isArray(income.conversions) && income.conversions.length > 0 && (
        <ul className="expense-detail__conversions" aria-label="Equivalencias">
          {income.conversions.map((conversion) => (
            <li key={conversion.currency}>
              ≈ {conversion.currency} {formatAmount(conversion.amount)}
            </li>
          ))}
        </ul>
      )}
      <dl className="expense-detail__data">
        <dt>Fecha</dt>
        <dd>
          {formatIsoDate(income.date)}
          {income.projected && (
            <>
              {' '}
              <span className="activity-badge" data-testid="projected-badge">
                {PROJECTED_LABEL}
              </span>
            </>
          )}
        </dd>
        <dt>Categoría</dt>
        <dd>{labelOf(INCOME_CATEGORY_OPTIONS, income.category)}</dd>
        <dt>Medio de cobro</dt>
        <dd>{labelOf(INCOME_PAYMENT_METHOD_OPTIONS, income.paymentMethod)}</dd>
        <dt>Descripción</dt>
        <dd>{income.description || NO_DESCRIPTION_LABEL}</dd>
      </dl>
    </section>
  )
}

/**
 * Detail of a personal income (specs/033-income-management, FR-016). Read only on
 * purpose: incomes are immutable once registered, so the screen offers no way to edit
 * or delete one. A missing, foreign or malformed id is the same "not found".
 */
export default function IncomeDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { setUser } = useAuth()
  const [state, setState] = useState({ status: 'loading', income: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getIncome(id).then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setState({ status: 'ready', income: result.income })
      } else if (result.status === 401) {
        setUser(null)
      } else if (result.status === 404 || result.status === 400) {
        setState({ status: 'not-found', income: null })
      } else {
        setState({ status: 'error', income: null })
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, attempt, setUser])

  const retry = () => {
    setState({ status: 'loading', income: null })
    setAttempt((value) => value + 1)
  }

  const back = backTarget(location.state)
  const title =
    state.income?.description ||
    labelOf(INCOME_CATEGORY_OPTIONS, state.income?.category) ||
    'Detalle del ingreso'

  return (
    <main className="page">
      <Link className="home-link" to={back}>
        <span aria-hidden="true">←</span> Volver
      </Link>
      <h1>{title}</h1>

      {state.status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {state.status === 'not-found' && <p role="alert">{INCOME_NOT_FOUND_MESSAGE}</p>}
      {state.status === 'error' && (
        <div role="alert">
          <p>{INCOME_DETAIL_ERROR_MESSAGE}</p>
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}
      {state.status === 'ready' && <IncomeDetail income={state.income} />}
    </main>
  )
}
