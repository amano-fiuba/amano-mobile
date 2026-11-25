import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getStatisticsSummary, STATISTICS_ERROR_MESSAGE } from '../api/statisticsClient'
import { useAuth } from '../auth/AuthContext'
import HomeLink from '../components/HomeLink'
import PieChart from '../components/charts/PieChart'
import {
  CATEGORY_OPTIONS,
  INCOME_CATEGORY_OPTIONS,
  categoryColor,
  currencyLabel,
  incomeCategoryColor,
  labelOf,
} from '../validation/expenseCatalog'
import { formatAmount } from '../validation/expenseFormat'
import { MONTH_NAMES } from '../validation/months'
import './MainPage.scss'
import './groups/groups.scss'
import './StatisticsPage.scss'
import MobileTabs, { MobileTab, MobileTabGroup } from '../mobile/MobileTabs'

// Same "all months" value as the personal activity filters: an explicit empty
// month parameter, so it can be told apart from the default current month.
const ALL_MONTHS = ''

function today() {
  const now = new Date()
  return { year: String(now.getFullYear()), month: String(now.getMonth() + 1) }
}

/**
 * Period in the address (`?year=&month=`, plan D11). A missing or invalid value is
 * the current one; an explicit `month=` means "Todos los meses" (all of them).
 */
function periodFromParams(params) {
  const current = today()
  const rawYear = params.get('year') ?? ''
  const rawMonth = params.get('month')
  const month = rawMonth === null
    ? current.month
    : rawMonth === ALL_MONTHS || /^(1[0-2]|[1-9])$/.test(rawMonth)
      ? rawMonth
      : current.month
  return {
    year: /^\d{4}$/.test(rawYear) ? rawYear : current.year,
    month,
  }
}

/** Address of a period: the current year and month are left out; all months is `month=`. */
function paramsOf({ year, month }) {
  const current = today()
  const params = {}
  if (year !== current.year) {
    params.year = year
  }
  if (month === ALL_MONTHS || month !== current.month) {
    params.month = month
  }
  return params
}

/** Current year, years with expenses and the one in the address, newest first. */
function yearOptionsOf(years, selected) {
  const set = new Set([today().year, selected, ...years.map(String)])
  return [...set].sort((a, b) => Number(b) - Number(a))
}

function periodName({ year, month }) {
  return month === ALL_MONTHS
    ? `todo el año ${year}`
    : `${MONTH_NAMES[Number(month) - 1].toLowerCase()} de ${year}`
}

function formatPercentage(value) {
  return `${String(value).replace('.', ',')} %`
}

function money(currency, amount) {
  return `${currency} ${formatAmount(amount)}`
}

/**
 * Pie and category list of one kind of movement (FR-014, FR-015); the catalog and
 * the colors are parameters so expenses and incomes share it (plan D16).
 */
function Breakdown({ title, titleId, breakdown, currency, emptyMessage, options, colorOf }) {
  const items = breakdown.categories.map((entry) => {
    const name = labelOf(options, entry.category) || entry.category
    const amount = money(currency, entry.amount)
    const percentage = formatPercentage(entry.percentage)
    return {
      key: entry.category,
      label: name,
      color: colorOf(entry.category),
      value: Number(entry.amount),
      amount,
      percentage,
      detail: `${name} · ${amount} · ${percentage}`,
    }
  })
  return (
    <section className="statistics-breakdown" aria-labelledby={titleId}>
      <header className="statistics-breakdown__header">
        <h2 id={titleId}>{title}</h2>
        {items.length > 0 && <strong>{money(currency, breakdown.total)}</strong>}
      </header>
      {items.length === 0 ? (
        <p className="statistics-breakdown__empty">{emptyMessage}</p>
      ) : (
        <div className="statistics-breakdown__body">
          <PieChart
            items={items}
            label={`${title}: ${items.map((item) => item.detail).join('; ')}`}
          />
        </div>
      )}
    </section>
  )
}

/**
 * Statistics of one period, keyed by it so an answer for a previous period never
 * replaces a newer one (plan D12, D18). The expenses tab belongs to the page so it
 * survives a period change (FR-005).
 */
function StatisticsResults({ period, onYears, tab, onTabChange }) {
  const { setUser } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ attempt: -1, status: 'loading', data: null })

  useEffect(() => {
    let cancelled = false
    getStatisticsSummary(period).then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setState({ attempt, status: 'ready', data: result.statistics })
        onYears(result.statistics.years)
      } else if (result.status === 401) {
        setUser(null)
      } else {
        setState({ attempt, status: 'error', data: null })
      }
    })
    return () => {
      cancelled = true
    }
    // The period is fixed for this component (it is keyed by it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, setUser])

  if (state.attempt !== attempt) {
    return <p aria-busy="true">Cargando…</p>
  }
  if (state.status === 'error') {
    return (
      <div className="activity-search__error" role="alert">
        <p>{STATISTICS_ERROR_MESSAGE}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Reintentar
        </button>
      </div>
    )
  }

  const { currency, expenses, income, comparison } = state.data
  const { personal, group } = expenses
  const name = periodName(period)
  const noExpenses = personal.categories.length === 0 && group.categories.length === 0
  const noIncome = income.categories.length === 0
  const notices = (
    <>
      {expenses.excludedCount > 0 && (
        <p className="statistics-excluded" role="status">
          {expenses.excludedCount === 1
            ? `1 gasto no se pudo convertir a ${currency} y no está incluido.`
            : `${expenses.excludedCount} gastos no se pudieron convertir a ${currency} y no están incluidos.`}
        </p>
      )}
      {income.excludedCount > 0 && (
        <p className="statistics-excluded" role="status">
          {income.excludedCount === 1
            ? `1 ingreso no se pudo convertir a ${currency} y no está incluido.`
            : `${income.excludedCount} ingresos no se pudieron convertir a ${currency} y no están incluidos.`}
        </p>
      )}
    </>
  )

  if (noExpenses && noIncome) {
    return (
      <>
        {notices}
        <p role="status">
          No registraste gastos ni ingresos en {name}.{' '}
          <Link to="/expenses/new">Registrar un gasto</Link>{' '}
          <Link to="/incomes/new">Registrar un ingreso</Link>
        </p>
      </>
    )
  }

  const balanceNumber = Number(comparison.balance)
  const balanceSign = balanceNumber < 0 ? '−' : balanceNumber > 0 ? '+' : ''
  const balanceText = `${balanceSign}${money(currency, comparison.balance.replace('-', ''))}`
  const incomeValue = Number(comparison.income)
  const expensesValue = Number(comparison.expenses)
  const comparisonTotal = incomeValue + expensesValue
  const share = (value) => (comparisonTotal > 0 ? (value / comparisonTotal) * 100 : 0)
  const comparisonItems = [
    {
      key: 'income',
      label: 'Ingresos',
      value: incomeValue,
      amount: money(currency, comparison.income),
    },
    {
      key: 'expenses',
      label: 'Gastos',
      value: expensesValue,
      amount: money(currency, comparison.expenses),
    },
  ].map((item) => ({ ...item, percentage: formatPercentage(share(item.value).toFixed(1)) }))

  const expenseBreakdown = (title, id, breakdown, emptyMessage) => (
    <Breakdown
      title={title}
      titleId={id}
      breakdown={breakdown}
      currency={currency}
      emptyMessage={emptyMessage}
      options={CATEGORY_OPTIONS}
      colorOf={categoryColor}
    />
  )
  const tabs = [
    {
      key: 'personal',
      label: 'Personales',
      breakdown: expenseBreakdown(
        'Gastos personales',
        'statistics-personal',
        personal,
        `No registraste gastos personales en ${name}.`,
      ),
    },
    {
      key: 'group',
      label: 'Grupales',
      breakdown: expenseBreakdown(
        'Gastos grupales',
        'statistics-group',
        group,
        `No tuviste gastos grupales en ${name}.`,
      ),
    },
  ]
  const onTabKeyDown = (event) => {
    const next = { ArrowLeft: tab - 1, ArrowRight: tab + 1 }[event.key]
    if (next >= 0 && next < tabs.length) {
      onTabChange(next)
      document.getElementById(`statistics-tab-${tabs[next].key}`)?.focus()
    }
  }

  return (
    <>
      {notices}
      {/* En la app (mobile 002): balance, ingresos y gastos en pestañas. */}
      <MobileTabs name="statistics" label="Secciones de estadísticas">
      <MobileTab id="balance" label="Balance">
      <section className="statistics-comparison" aria-labelledby="statistics-comparison">
        <h2 id="statistics-comparison">Ingresos y gastos de {name}</h2>
        <div
          className="statistics-bar"
          role="img"
          aria-label={`Ingresos ${comparisonItems[0].amount} (${comparisonItems[0].percentage}) y gastos ${comparisonItems[1].amount} (${comparisonItems[1].percentage})`}
        >
          {comparisonItems
            .filter((item) => item.value > 0)
            .map((item) => (
              <span
                key={item.key}
                className={`statistics-bar__segment statistics-bar__segment--${item.key}`}
                style={{ width: `${share(item.value)}%` }}
              >
                {item.percentage}
              </span>
            ))}
        </div>
        <dl className="statistics-comparison__figures">
          <div className="statistics-comparison__income">
            <dt>Ingresos</dt>
            <dd>{comparisonItems[0].amount}</dd>
          </div>
          <div className="statistics-comparison__expenses">
            <dt>Gastos</dt>
            <dd>{comparisonItems[1].amount}</dd>
          </div>
          <div
            className={`statistics-balance${balanceNumber < 0 ? ' is-negative' : ' is-positive'}`}
          >
            <dt>Balance del período</dt>
            <dd>{balanceText}</dd>
            {balanceNumber < 0 && <small>Los gastos superan a los ingresos</small>}
          </div>
        </dl>
        <small className="statistics-comparison__currency">
          Importes en {currencyLabel(currency)} ({currency})
        </small>
      </section>
      </MobileTab>

      <MobileTabGroup className="statistics-columns">
        <MobileTab id="income" label="Ingresos">
        <div className="statistics-column">
          <div className="statistics-tabs" aria-hidden="true">
            <span className="statistics-tabs__label">Personales</span>
          </div>
          {noIncome ? (
            <section className="statistics-breakdown" aria-labelledby="statistics-income">
              <h2 id="statistics-income">Ingresos personales</h2>
              <p className="statistics-breakdown__empty" role="status">
                No registraste ingresos efectivizados en {name}.{' '}
                <Link to="/incomes/new">Registrar un ingreso</Link>
              </p>
            </section>
          ) : (
            <Breakdown
              title="Ingresos personales"
              titleId="statistics-income"
              breakdown={income}
              currency={currency}
              emptyMessage=""
              options={INCOME_CATEGORY_OPTIONS}
              colorOf={incomeCategoryColor}
            />
          )}
        </div>
        </MobileTab>
        <MobileTab id="expenses" label="Gastos">
        <div className="statistics-column">
          {noExpenses ? (
            <section className="statistics-breakdown" aria-labelledby="statistics-expenses">
              <h2 id="statistics-expenses">Gastos</h2>
              <p className="statistics-breakdown__empty" role="status">
                No registraste gastos en {name}. <Link to="/expenses/new">Registrar un gasto</Link>
              </p>
            </section>
          ) : (
            <>
              <div className="statistics-tabs" role="tablist" aria-label="Tipo de gasto">
                {tabs.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    id={`statistics-tab-${item.key}`}
                    aria-selected={index === tab}
                    aria-controls="statistics-expenses-panel"
                    tabIndex={index === tab ? 0 : -1}
                    onClick={() => onTabChange(index)}
                    onKeyDown={onTabKeyDown}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div
                id="statistics-expenses-panel"
                role="tabpanel"
                aria-labelledby={`statistics-tab-${tabs[tab].key}`}
              >
                {tabs[tab].breakdown}
              </div>
            </>
          )}
        </div>
        </MobileTab>
      </MobileTabGroup>
      </MobileTabs>
    </>
  )
}

// Pantalla de estadísticas (032 y 034): comparación de ingresos y gastos en una barra, dos columnas
// de ingresos y gastos (personales o grupales) por categoría, de un mes o de todo el año ("Todos los
// meses"). El período vive en la dirección, reemplazando la entrada del historial para no llenar "Atrás".
export default function StatisticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = periodFromParams(searchParams)
  const [years, setYears] = useState([])
  const [tab, setTab] = useState(0)

  const navigate = (next) => setSearchParams(paramsOf(next), { replace: true })

  return (
    <main className="page statistics-page">
      <HomeLink />
      <h1>Estadísticas</h1>

      <form className="statistics-filters" onSubmit={(event) => event.preventDefault()}>
        <select
          className="list-search__sort"
          aria-label="Mes"
          value={period.month}
          onChange={(event) => navigate({ ...period, month: event.target.value })}
        >
          <option value={ALL_MONTHS}>Todos los meses</option>
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="list-search__sort"
          aria-label="Año"
          value={period.year}
          onChange={(event) => navigate({ ...period, year: event.target.value })}
        >
          {yearOptionsOf(years, period.year).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </form>

      <StatisticsResults
        key={`${period.year}-${period.month}`}
        period={period}
        onYears={setYears}
        tab={tab}
        onTabChange={setTab}
      />
    </main>
  )
}
