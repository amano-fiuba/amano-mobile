import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { SEARCH_INCOMES_ERROR_MESSAGE, searchIncomes } from '../../api/incomeClient'
import { useAuth } from '../../auth/AuthContext'
import {
  INCOME_CATEGORY_OPTIONS,
  INCOME_PAYMENT_METHOD_OPTIONS,
  labelOf,
} from '../../validation/expenseCatalog'
import { formatAmount, formatIsoDate } from '../../validation/expenseFormat'
import Pagination from './Pagination'
import { ALL_YEARS, MONTHS, NO_RESULTS_MESSAGE } from './activityHelpers'

export const PROJECTED_BADGE = 'Proyectado'

// Each income is a card with a chevron, like the expenses and "Mis grupos" rows; a
// scheduled one (date after today) carries the "Proyectado" badge (spec 033, FR-009).
function IncomeItem({ income, from }) {
  const category = labelOf(INCOME_CATEGORY_OPTIONS, income.category)
  return (
    <li>
      <Link to={`/incomes/${income.id}`} state={{ from }} className="group-row expense-row">
        <span className="group-row__body">
          <span className="group-row__title">
            <strong>{income.description || category}</strong>
            <span className="main-expense__amount">
              {income.currency} {formatAmount(income.amount)}
              {Array.isArray(income.conversions) &&
                income.conversions.map((conversion) => (
                  <small key={conversion.currency} className="main-expense__conversion">
                    ≈ {conversion.currency} {formatAmount(conversion.amount)}
                  </small>
                ))}
            </span>
          </span>
          <small>
            {formatIsoDate(income.date)} · {category} ·{' '}
            {labelOf(INCOME_PAYMENT_METHOD_OPTIONS, income.paymentMethod)}
            {income.projected && (
              <>
                {' '}
                ·{' '}
                <span className="activity-badge" data-testid="projected-badge">
                  {PROJECTED_BADGE}
                </span>
              </>
            )}
          </small>
        </span>
        <span className="group-row__chevron" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  )
}

function emptyMessageOf(year, month) {
  if (year === ALL_YEARS) {
    return 'Todavía no registraste ingresos.'
  }
  if (month) {
    return `No registraste ingresos en ${MONTHS[Number(month) - 1].toLowerCase()} de ${year}.`
  }
  return `No registraste ingresos en ${year}.`
}

/**
 * One page of the incomes of the criteria in force (specs/033-income-management, US2):
 * the whole year/month (or every year) without a term, the matches with one. Same
 * behavior as the expense results: keyed by the filters by the page, so an answer of a
 * previous search never overwrites a newer one; while another page loads the previous
 * one stays visible, dimmed.
 */
export default function IncomeResults({
  term,
  year,
  month,
  page,
  size,
  from,
  onPage,
  onPageResolved,
  onListShown,
}) {
  const { setUser } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, status: 'loading', data: null })
  const listRef = useRef(null)
  const requestKey = `${page}|${size}|${attempt}`

  useEffect(() => {
    let cancelled = false
    searchIncomes({
      term,
      year: year === ALL_YEARS ? null : year,
      month: month || null,
      page,
      size,
    }).then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setState({ key: requestKey, status: 'ready', data: result })
        if (result.page !== page) {
          // The asked page does not exist any more: the backend sent the last one.
          onPageResolved(result.page)
        }
      } else if (result.status === 401) {
        setUser(null)
      } else {
        setState({ key: requestKey, status: 'error', data: null })
      }
    })
    return () => {
      cancelled = true
    }
    // onPageResolved changes on every render of the page; the request only depends on
    // the criteria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, year, month, page, size, attempt, setUser])

  const loading = state.key !== requestKey
  const data = state.data

  useEffect(() => {
    if (!loading && listRef.current) {
      onListShown(listRef.current)
    }
  }, [loading, data, onListShown])

  if (loading && !data) {
    return <p aria-busy="true">Buscando…</p>
  }
  if (!loading && state.status === 'error') {
    return (
      <div className="activity-search__error" role="alert">
        <p>{SEARCH_INCOMES_ERROR_MESSAGE}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Reintentar
        </button>
      </div>
    )
  }
  if (data.incomes.length === 0) {
    if (term) {
      return (
        <p role="status" className="activity-search__empty">
          {NO_RESULTS_MESSAGE}
        </p>
      )
    }
    return (
      <p role="status">
        {emptyMessageOf(year, month)} <Link to="/incomes/new">Registrar un ingreso</Link>
      </p>
    )
  }
  return (
    <div className="activity-results" aria-busy={loading}>
      {term && (
        <p className="activity-search__count" aria-live="polite">
          {data.totalElements === 1 ? '1 resultado' : `${data.totalElements} resultados`}
        </p>
      )}
      <ul ref={listRef} className="group-rows expense-rows" aria-label="Ingresos">
        {data.incomes.map((income) => (
          <IncomeItem key={income.id} income={income} from={from} />
        ))}
      </ul>
      {data.totalPages > 1 && (
        <Pagination page={data.page} totalPages={data.totalPages} onChange={onPage} />
      )}
    </div>
  )
}
