import { useEffect, useState } from 'react'
import { BALANCE_ERROR_MESSAGE, getBalance } from '../../api/incomeClient'
import { currentDateIn, deviceTimeZone } from '../../hooks/useCurrentDate'
import { MONTH_NAMES } from '../../validation/months'
import { formatAmount } from '../../validation/expenseFormat'

/** Current { year, month (1-12) } in the device time zone. */
function currentPeriod() {
  const [, month, year] = currentDateIn(deviceTimeZone()).split('/')
  return { year: Number(year), month: Number(month) }
}

/** "1234.50" → "1.234,50"; "-250.00" → "−250,00" (typographic minus). */
function formatSigned(canonical, prefix) {
  const text = String(canonical ?? '')
  const negative = text.startsWith('-')
  const formatted = formatAmount(negative ? text.slice(1) : text)
  return negative ? `−${formatted}` : `${prefix}${formatted}`
}

/**
 * Monthly balance of the current month on the main screen: income (green, "+"),
 * expenses (red, "-") and the net balance, in the account's main currency, from
 * `GET /api/balance` of the month in force. Shows a skeleton while loading and a
 * message with "Reintentar" when the balance cannot be obtained.
 */
export default function MonthlyBalanceSummaryCard() {
  const [period] = useState(currentPeriod)
  const [attempt, setAttempt] = useState(0)
  // Tagged with the attempt it belongs to, so no state is reset inside the effect.
  const [answer, setAnswer] = useState({ attempt: null, status: 'loading', balance: null })

  useEffect(() => {
    let cancelled = false
    getBalance({ year: period.year, month: period.month }).then((result) => {
      if (!cancelled) {
        setAnswer(
          result.ok
            ? { attempt, status: 'ready', balance: result.balance }
            : { attempt, status: 'error', balance: null },
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [period, attempt])

  const state = answer.attempt === attempt ? answer : { status: 'loading', balance: null }
  const title = `Balance de ${MONTH_NAMES[period.month - 1]}`

  if (state.status === 'error') {
    return (
      <section className="main-card monthly-balance" aria-labelledby="monthly-balance-title">
        <h2 id="monthly-balance-title">{title}</h2>
        <p role="alert">{BALANCE_ERROR_MESSAGE}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Reintentar
        </button>
      </section>
    )
  }

  const loading = state.status === 'loading'
  const balance = state.balance
  const currency = loading ? '' : ` ${balance.currency}`
  const negative = !loading && String(balance.net).startsWith('-')

  const value = (text) =>
    loading ? <span className="monthly-balance__skeleton" aria-hidden="true" /> : `${text}${currency}`

  return (
    <section
      className="main-card monthly-balance"
      aria-labelledby="monthly-balance-title"
      aria-busy={loading}
    >
      <h2 id="monthly-balance-title">{title}</h2>
      {loading && <span className="monthly-balance__sr">Cargando…</span>}
      <dl>
        <div>
          <dt>Ingresos</dt>
          <dd className="monthly-balance__income" data-testid="monthly-income">
            {value(loading ? '' : formatSigned(balance.income, '+'))}
          </dd>
        </div>
        <div>
          <dt>Egresos</dt>
          <dd className="monthly-balance__expenses" data-testid="monthly-expenses">
            {value(loading ? '' : `-${formatAmount(String(balance.expenses).replace(/^-/, ''))}`)}
          </dd>
        </div>
        <div className={`monthly-balance__net${negative ? ' monthly-balance__net--negative' : ''}`}>
          <dt>Balance</dt>
          <dd data-testid="monthly-net">
            {value(loading ? '' : formatSigned(balance.net, '+'))}
          </dd>
        </div>
      </dl>
    </section>
  )
}
