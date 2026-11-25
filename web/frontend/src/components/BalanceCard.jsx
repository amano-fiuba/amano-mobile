import { useEffect, useState } from 'react'
import { BALANCE_ERROR_MESSAGE, getBalance } from '../api/incomeClient'
import { formatAmount } from '../validation/expenseFormat'

export const BALANCE_TITLE = 'Balance neto'

/** "1234.50" → "1.234,50"; "-250.00" → "−250,00" (the sign is kept outside of formatAmount). */
function signedAmount(canonical, { explicitPlus = false } = {}) {
  const text = String(canonical ?? '')
  const negative = text.startsWith('-')
  const formatted = formatAmount(negative ? text.slice(1) : text)
  if (negative) {
    return `−${formatted}`
  }
  return explicitPlus ? `+${formatted}` : formatted
}

/**
 * Personal balance card (specs/033-income-management, FR-015): income, expenses and
 * the net balance of the period in the account's main currency. Income is green and
 * expenses red; the net sits on the right of the card, green when positive and red
 * when negative. The net is the highlighted figure, with an explicit sign plus a
 * distinct icon and wording for a negative one (never only colour). It asks
 * `GET /api/balance` every time it mounts and whenever `year`, `month` or
 * `refreshKey` change; it keeps no cache of its own,
 * so a new `refreshKey` (left by the new income screen) always recalculates. A
 * failure shows a message with "Reintentar". `year` is omitted for "all years".
 */
export default function BalanceCard({ year, month, refreshKey }) {
  // Last answer, tagged with the request it belongs to: an answer for other inputs
  // counts as "still loading", so no state is reset synchronously inside the effect.
  const [answer, setAnswer] = useState({ key: null, status: 'loading', balance: null })
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${year ?? ''}|${month ?? ''}|${refreshKey ?? ''}|${attempt}`

  useEffect(() => {
    let cancelled = false
    getBalance({ year, month }).then((result) => {
      if (!cancelled) {
        setAnswer(
          result.ok
            ? { key: requestKey, status: 'ready', balance: result.balance }
            : { key: requestKey, status: 'error', balance: null },
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [year, month, requestKey])

  const state = answer.key === requestKey ? answer : { status: 'loading', balance: null }

  if (state.status === 'error') {
    return (
      <section className="main-card balance-card" aria-label={BALANCE_TITLE} data-testid="balance-card">
        <p role="alert">{BALANCE_ERROR_MESSAGE}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Reintentar
        </button>
      </section>
    )
  }

  const loading = state.status === 'loading'
  const balance = state.balance
  const negative = !loading && String(balance.net).startsWith('-')
  const currency = loading ? '' : ` ${balance.currency}`

  return (
    <section
      className="main-card balance-card"
      aria-label={BALANCE_TITLE}
      aria-busy={loading}
      data-testid="balance-card"
    >
      <dl className="balance-card__figures">
        <div>
          <dt>Ingresos</dt>
          <dd className="balance-card__income">
            {loading ? '…' : `${signedAmount(balance.income)}${currency}`}
          </dd>
        </div>
        <div>
          <dt>Gastos</dt>
          <dd className="balance-card__expenses">
            {loading ? '…' : `${signedAmount(balance.expenses)}${currency}`}
          </dd>
        </div>
        <div
          className={`balance-card__net${negative ? ' balance-card__net--negative' : ' balance-card__net--positive'}`}
          data-testid="balance-net"
        >
          <dt>{BALANCE_TITLE}</dt>
          <dd>
            {loading ? (
              '…'
            ) : (
              <>
                <span aria-hidden="true">{negative ? '▼ ' : '▲ '}</span>
                {signedAmount(balance.net, { explicitPlus: true })}
                {currency}
                <span className="balance-card__sr">{negative ? ' (a favor de los gastos)' : ' (a favor)'}</span>
              </>
            )}
          </dd>
        </div>
      </dl>
      {!loading && balance.projectedIncome && Number(balance.projectedIncome) > 0 && (
        <p className="balance-card__projected">
          Proyectado: {signedAmount(balance.projectedIncome, { explicitPlus: true })}
          {currency}
        </p>
      )}
    </section>
  )
}
