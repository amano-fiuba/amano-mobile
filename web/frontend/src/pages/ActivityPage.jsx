import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { listIncomeYears } from '../api/incomeClient'
import {
  listExpenseYears,
  SEARCH_EXPENSES_ERROR_MESSAGE,
  searchExpenses,
} from '../api/expenseClient'
import { useAuth } from '../auth/AuthContext'
import BalanceCard from '../components/BalanceCard'
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS, labelOf } from '../validation/expenseCatalog'
import { formatAmount, formatIsoDate } from '../validation/expenseFormat'
import './MainPage.scss'
import './groups/groups.scss'
import HomeLink from '../components/HomeLink'
import IncomeResults from '../components/activity/IncomeResults'
import Pagination from '../components/activity/Pagination'
import SearchFilters from '../components/activity/SearchFilters'
import {
  ALL_MONTHS,
  ALL_YEARS,
  DEBOUNCE_MS,
  ESTIMATED_ROW_HEIGHT,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  MONTHS,
  NO_RESULTS_MESSAGE,
  RESIZE_PAUSE_MS,
  SEARCH_PLACEHOLDER,
  TOO_SHORT_MESSAGE,
  currentYear,
  isSearchable,
  pageSizeFor,
  rowHeightOf,
} from '../components/activity/activityHelpers'

// The messages and limits stay importable from the page, where the tests expect them.
export {
  ALL_MONTHS,
  ALL_YEARS,
  DEBOUNCE_MS,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  NO_RESULTS_MESSAGE,
  SEARCH_PLACEHOLDER,
  TOO_SHORT_MESSAGE,
}

const VIEW_EXPENSES = 'expenses'
const VIEW_INCOMES = 'incomes'

/**
 * Criteria in force, read from the address (`?q=&year=&month=&page=&view=`, plan D7,
 * D12, D14). Without `year` the screen shows the current year; an invalid year
 * falls back to it, an invalid month to the whole year (also with "Todos los
 * años"), an invalid page to the first one and a term that is too short or too
 * long is ignored (edge cases).
 */
function criteriaFromParams(params) {
  const rawTerm = (params.get('q') ?? '').trim()
  const rawYear = params.get('year')
  const year = rawYear === ALL_YEARS || /^\d{4}$/.test(rawYear ?? '') ? rawYear : currentYear()
  const rawMonth = params.get('month') ?? ''
  const month = year !== ALL_YEARS && /^(1[0-2]|[1-9])$/.test(rawMonth) ? rawMonth : ALL_MONTHS
  const rawPage = params.get('page') ?? ''
  const page = /^\d{1,6}$/.test(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : 1
  // 033: `view=incomes` shows the personal incomes; anything else is the expenses.
  const view = params.get('view') === VIEW_INCOMES ? VIEW_INCOMES : VIEW_EXPENSES
  return { term: isSearchable(rawTerm) ? rawTerm : '', year, month, page, view }
}

/** Address of some criteria: the defaults (no term, current year, all months, page 1) are left out. */
function paramsOf({ term, year, month, page, view }) {
  const params = {}
  if (view === VIEW_INCOMES) {
    params.view = VIEW_INCOMES
  }
  if (term) {
    params.q = term
  }
  if (year !== currentYear()) {
    params.year = year
  }
  if (month) {
    params.month = month
  }
  if (page > 1) {
    params.page = String(page)
  }
  return params
}

// Each expense is a card with a chevron, like the rows of "Mis grupos" (FR-013).
function ExpenseItem({ expense, from, highlightDebtId }) {
  const category = labelOf(CATEGORY_OPTIONS, expense.category)
  const rowRef = useRef(null)
  const targetsDebt = highlightDebtId != null
    && String(expense.debtId ?? expense.id) === String(highlightDebtId)

  // Deep link de una notificación de deuda sin grupo (035 FR-017): scroll y
  // resaltado efímero de 2 s sobre la transacción correspondiente. Se manipula
  // el atributo del DOM para no disparar renders desde el efecto.
  useEffect(() => {
    if (!targetsDebt) return undefined
    const node = rowRef.current
    node?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    node?.setAttribute('data-highlighted', 'true')
    const timer = setTimeout(() => node?.removeAttribute('data-highlighted'), 2000)
    return () => {
      clearTimeout(timer)
      node?.removeAttribute('data-highlighted')
    }
  }, [targetsDebt])

  return (
    <li ref={rowRef} data-debt-id={expense.debtId ?? expense.id}>
      <Link to={`/expenses/${expense.id}`} state={{ from }} className="group-row expense-row">
        <span className="group-row__body">
          <span className="group-row__title">
            <strong>{expense.description || category}</strong>
            <span className="main-expense__amount">
              {expense.currency} {formatAmount(expense.amount)}
              {Array.isArray(expense.conversions) &&
                expense.conversions.map((conversion) => (
                  <small key={conversion.currency} className="main-expense__conversion">
                    ≈ {conversion.currency} {formatAmount(conversion.amount)}
                  </small>
                ))}
            </span>
          </span>
          <small>
            {formatIsoDate(expense.date)} · {category} ·{' '}
            {labelOf(PAYMENT_METHOD_OPTIONS, expense.paymentMethod)}
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
    return 'Todavía no registraste gastos.'
  }
  if (month) {
    return `No registraste gastos en ${MONTHS[Number(month) - 1].toLowerCase()} de ${year}.`
  }
  return `No registraste gastos en ${year}.`
}

/**
 * One page of the expenses of the criteria in force (FR-003..FR-009, FR-012,
 * FR-019, FR-021): the whole year/month (or every year) without a term, the
 * matches with one. Keyed by the filters, so an answer of a previous search never
 * overwrites a newer one (D9); while another page loads the previous one stays
 * visible, dimmed, so the pagination does not jump.
 */
function ActivityResults({ term, year, month, page, size, from, highlightDebtId,
  onPage, onPageResolved, onListShown }) {
  const { setUser } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, status: 'loading', data: null })
  const listRef = useRef(null)
  const requestKey = `${page}|${size}|${attempt}`

  useEffect(() => {
    let cancelled = false
    searchExpenses({
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
    // onPageResolved changes on every render of the page; the request only
    // depends on the criteria.
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
        <p>{SEARCH_EXPENSES_ERROR_MESSAGE}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Reintentar
        </button>
      </div>
    )
  }
  if (data.expenses.length === 0) {
    if (term) {
      return (
        <p role="status" className="activity-search__empty">
          {NO_RESULTS_MESSAGE}
        </p>
      )
    }
    return (
      <p role="status">
        {emptyMessageOf(year, month)} <Link to="/expenses/new">Registrar un gasto</Link>
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
      <ul ref={listRef} className="group-rows expense-rows" aria-label="Gastos">
        {data.expenses.map((expense) => (
          <ExpenseItem key={expense.id} expense={expense} from={from} highlightDebtId={highlightDebtId} />
        ))}
      </ul>
      {data.totalPages > 1 && (
        <Pagination page={data.page} totalPages={data.totalPages} onChange={onPage} />
      )}
    </div>
  )
}

// Pantalla de actividad personal (specs/031-buscar-en-actividad-personal): muestra
// lo que indican los selectores de mes y año (por defecto, todo el año actual) y,
// si hay texto, solo lo que coincide, de a una página cuyo tamaño depende del alto
// de la pantalla. Se consulta al dejar de escribir (o con Enter), al borrar el
// texto (la x del campo), al cambiar el mes, el año o la página. Los criterios
// viven en la dirección, reemplazando la entrada del historial para no llenar "Atrás".
export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const criteria = criteriaFromParams(searchParams)
  const [term, setTerm] = useState(criteria.term)
  // Years with movements of the view they belong to (033): the other view's are ignored.
  const [yearsOf, setYearsOf] = useState({ view: null, years: [] })
  const [pageSize, setPageSize] = useState(null)
  const topRef = useRef(null)
  const filtersRef = useRef(null)
  const rowHeightRef = useRef(ESTIMATED_ROW_HEIGHT)
  const rowsMeasuredRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const view = criteria.view
    const load = view === VIEW_INCOMES ? listIncomeYears : listExpenseYears
    load().then((result) => {
      // Without the years the selector still offers the current one and "Todos".
      if (!cancelled && result.ok) {
        setYearsOf({ view, years: result.years })
      }
    })
    return () => {
      cancelled = true
    }
  }, [criteria.view])
  const years = yearsOf.view === criteria.view ? yearsOf.years : []

  const trimmed = term.trim()
  const from = `${location.pathname}${location.search}`

  const navigate = (next) => setSearchParams(paramsOf(next), { replace: true })

  // Puts the filters in force from page 1; a term that is too short counts as no term.
  const apply = (rawTerm, year, month) => {
    const value = rawTerm.trim()
    const nextTerm = isSearchable(value) ? value : ''
    if (nextTerm !== criteria.term || year !== criteria.year || month !== criteria.month) {
      navigate({ term: nextTerm, year, month, page: 1, view: criteria.view })
    }
  }

  // Recomputes the page size; the new page keeps the first card in sight (FR-022).
  const refit = () => {
    const next = pageSizeFor(filtersRef.current, rowHeightRef.current)
    if (next === pageSize) {
      return
    }
    setPageSize(next)
    if (pageSize !== null) {
      const page = Math.floor(((criteria.page - 1) * pageSize) / next) + 1
      if (page !== criteria.page) {
        navigate({ ...criteria, page })
      }
    }
  }
  const refitOnEvent = useEffectEvent(refit)

  // The first size is known before the first query is sent.
  useLayoutEffect(() => {
    refitOnEvent()
  }, [])

  useEffect(() => {
    let timer
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(refitOnEvent, RESIZE_PAUSE_MS)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // The real card height replaces the estimate once the first cards are drawn.
  const handleListShown = (list) => {
    if (rowsMeasuredRef.current) {
      return
    }
    const height = rowHeightOf(list)
    if (height) {
      rowsMeasuredRef.current = true
      rowHeightRef.current = height
      refit()
    }
  }

  const applyTypedTerm = useEffectEvent((typed) => apply(typed, criteria.year, criteria.month))

  useEffect(() => {
    const timer = setTimeout(() => applyTypedTerm(term), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [term])

  const handleTermChange = (event) => {
    const value = event.target.value
    setTerm(value)
    // Erasing the text (e.g. the x of the field) shows the year right away (FR-010).
    if (value.trim() === '') {
      apply('', criteria.year, criteria.month)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    apply(term, criteria.year, criteria.month)
  }

  const handleMonthChange = (event) => {
    apply(term, criteria.year, event.target.value)
  }

  // "Todos los años" has no months: the month goes back to all (FR-020).
  const handleYearChange = (event) => {
    const year = event.target.value
    apply(term, year, year === ALL_YEARS ? ALL_MONTHS : criteria.month)
  }

  const handlePage = (page) => {
    navigate({ ...criteria, page })
    topRef.current?.scrollIntoView?.({ block: 'start' })
  }

  const handlePageResolved = (page) => navigate({ ...criteria, page })

  // Changing between expenses and incomes keeps the text, year and month (033).
  const handleView = (view) => {
    if (view !== criteria.view) {
      navigate({ ...criteria, view, page: 1 })
    }
  }

  const showingIncomes = criteria.view === VIEW_INCOMES
  const ResultsView = showingIncomes ? IncomeResults : ActivityResults

  // Typing a new term: "Buscando…" until the pause puts it in force.
  const isTyping = isSearchable(trimmed) && trimmed !== criteria.term

  return (
    <main className="page activity-page" ref={topRef}>
      <HomeLink />
      <h1>Actividad personal</h1>

      <BalanceCard
        year={criteria.year === ALL_YEARS ? undefined : criteria.year}
        month={criteria.month || undefined}
        refreshKey={location.state?.refreshBalance}
      />

      <div className="activity-page__toolbar">
        <div className="activity-view" role="group" aria-label="Tipo de movimiento">
          <button
            type="button"
            aria-pressed={!showingIncomes}
            onClick={() => handleView(VIEW_EXPENSES)}
          >
            Gastos
          </button>
          <button
            type="button"
            aria-pressed={showingIncomes}
            onClick={() => handleView(VIEW_INCOMES)}
          >
            Ingresos
          </button>
        </div>
        {showingIncomes ? (
          <Link className="buttonLink" to="/incomes/new">
            Nuevo ingreso
          </Link>
        ) : (
          <Link className="buttonLink" to="/expenses/new">
            Nuevo gasto
          </Link>
        )}
      </div>

      <SearchFilters
        formRef={filtersRef}
        term={term}
        month={criteria.month}
        year={criteria.year}
        years={years}
        onTermChange={handleTermChange}
        onMonthChange={handleMonthChange}
        onYearChange={handleYearChange}
        onSubmit={handleSubmit}
      />

      {isTyping || pageSize === null ? (
        <p aria-busy="true">Buscando…</p>
      ) : (
        <ResultsView
          key={`${criteria.view}|${criteria.term}|${criteria.year}|${criteria.month}`}
          term={criteria.term}
          year={criteria.year}
          month={criteria.month}
          page={criteria.page}
          size={pageSize}
          from={from}
          highlightDebtId={searchParams.get('debt')}
          onPage={handlePage}
          onPageResolved={handlePageResolved}
          onListShown={handleListShown}
        />
      )}
    </main>
  )
}
