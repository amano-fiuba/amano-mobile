import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  RECURRING_LOAD_ERROR_MESSAGE,
  RECURRING_UPDATE_ERROR_MESSAGE,
  listRecurringExpenses,
  updateRecurringExpenseStatus,
} from '../api/expenseClient'
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  STATUS_OPTIONS,
  labelOf,
} from '../validation/expenseCatalog'
import { formatAmount, formatIsoDate } from '../validation/expenseFormat'
import { useSnackbar } from '../components/Snackbar'
import HomeLink from '../components/HomeLink'

// Exact messages of specs/009-pause-recurring-expense (FR-012..FR-014), exported
// for the tests.
export const EMPTY_MESSAGE = 'Todavía no tenés gastos recurrentes'
export const LOADING_MESSAGE = 'Cargando tus gastos recurrentes…'
export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Iniciá sesión nuevamente.'
export const FINISH_CONFIRMATION_MESSAGE =
  'Finalizar es definitivo: no se generarán más gastos de esta serie.'
export const PAUSED_MESSAGE = 'El gasto recurrente se pausó'
export const RESUMED_MESSAGE = 'El gasto recurrente se reanudó'
export const FINISHED_MESSAGE = 'El gasto recurrente se finalizó'

const SUCCESS_MESSAGES = {
  PAUSED: PAUSED_MESSAGE,
  ACTIVE: RESUMED_MESSAGE,
  FINISHED: FINISHED_MESSAGE,
}

const ACTION_LABELS = { PAUSED: 'Pausar', ACTIVE: 'Reanudar', FINISHED: 'Finalizar' }
const PENDING_LABELS = { PAUSED: 'Pausando…', ACTIVE: 'Reanudando…', FINISHED: 'Finalizando…' }

/** Actions offered for each state (FR-012): FINISHED offers none. */
const ACTIONS_BY_STATUS = {
  ACTIVE: ['PAUSED', 'FINISHED'],
  PAUSED: ['ACTIVE', 'FINISHED'],
  FINISHED: [],
}

/**
 * "Gastos recurrentes" (feature 009, US3/US4): the user's series with their state
 * and next date, plus Pausar / Reanudar / Finalizar. Finalizar asks for an inline
 * confirmation; while a change is in flight that series' actions are disabled and
 * the pressed one shows its progress label. On success the series is replaced by
 * the server's answer; on 404/409 the list is reloaded so it reflects the truth.
 */
export default function RecurringExpensesPage() {
  const [load, setLoad] = useState({ status: 'loading', expenses: [] })
  const [reloadToken, setReloadToken] = useState(0)
  const [pending, setPending] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const showSnackbar = useSnackbar()
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    let cancelled = false
    listRecurringExpenses().then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setLoad({ status: 'ready', expenses: result.expenses })
      } else if (result.status === 401) {
        setSessionExpired(true)
        setLoad({ status: 'error', expenses: [] })
      } else {
        setLoad({ status: 'error', expenses: [] })
      }
    })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const retry = () => {
    setLoad({ status: 'loading', expenses: [] })
    setReloadToken((token) => token + 1)
  }

  const changeStatus = async (expense, target) => {
    setPending({ id: expense.id, target })
    setError('')
    setSessionExpired(false)

    const result = await updateRecurringExpenseStatus(expense.id, target)
    setPending(null)
    setConfirmingId(null)

    if (result.ok) {
      setLoad((current) => ({
        ...current,
        expenses: current.expenses.map((item) =>
          item.id === result.expense.id ? result.expense : item,
        ),
      }))
      showSnackbar(SUCCESS_MESSAGES[target])
      return
    }
    if (result.network) {
      setError(RECURRING_UPDATE_ERROR_MESSAGE)
      return
    }
    if (result.status === 401) {
      setSessionExpired(true)
      return
    }
    setError(result.detail || RECURRING_UPDATE_ERROR_MESSAGE)
    setReloadToken((token) => token + 1)
  }

  const onAction = (expense, target) => {
    if (target === 'FINISHED') {
      setConfirmingId(expense.id)
      return
    }
    changeStatus(expense, target)
  }

  return (
    <main className="page recurring-page">
      <HomeLink />
      <h1>Gastos recurrentes</h1>

      {error && (
        <p role="alert" data-testid="recurring-error">
          {error}
        </p>
      )}
      {sessionExpired && (
        <p role="alert" data-testid="recurring-session">
          {SESSION_EXPIRED_MESSAGE} <Link to="/login">Iniciar sesión</Link>
        </p>
      )}

      {load.status === 'loading' && <p role="status">{LOADING_MESSAGE}</p>}

      {load.status === 'error' && !sessionExpired && (
        <div data-testid="recurring-load-error">
          <p role="alert">{RECURRING_LOAD_ERROR_MESSAGE}</p>
          <button type="button" className="buttonLink" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}

      {load.status === 'ready' && load.expenses.length === 0 && (
        <p data-testid="recurring-empty">
          {EMPTY_MESSAGE}. <Link to="/expenses/new">Registrar gasto</Link>
        </p>
      )}

      {load.status === 'ready' && load.expenses.length > 0 && (
        <ul className="recurring-list" aria-label="Tus gastos recurrentes">
          {load.expenses.map((expense) => {
            const busy = pending?.id === expense.id
            const title = expense.description || labelOf(CATEGORY_OPTIONS, expense.category)
            return (
              <li
                key={expense.id}
                className="recurring-item"
                data-testid={`recurring-${expense.id}`}
              >
                <div className="recurring-item__header">
                  <strong>{title}</strong>
                  <span className={`recurring-status recurring-status--${expense.status}`}>
                    {labelOf(STATUS_OPTIONS, expense.status)}
                  </span>
                </div>
                <p>
                  {formatAmount(expense.amount)} {expense.currency} ·{' '}
                  {labelOf(FREQUENCY_OPTIONS, expense.frequency)} ·{' '}
                  {labelOf(CATEGORY_OPTIONS, expense.category)}
                </p>
                <p className="recurring-item__dates">
                  Desde {formatIsoDate(expense.date)}
                  {expense.nextOccurrenceDate &&
                    ` · Próxima fecha: ${formatIsoDate(expense.nextOccurrenceDate)}`}
                </p>

                {confirmingId === expense.id ? (
                  <div
                    className="recurring-item__confirm"
                    role="group"
                    aria-label="Confirmar finalización"
                  >
                    <p>{FINISH_CONFIRMATION_MESSAGE}</p>
                    <button
                      type="button"
                      className="buttonLink"
                      disabled={busy}
                      onClick={() => changeStatus(expense, 'FINISHED')}
                    >
                      {busy ? PENDING_LABELS.FINISHED : 'Sí, finalizar'}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  ACTIONS_BY_STATUS[expense.status]?.length > 0 && (
                    <div className="recurring-item__actions">
                      {ACTIONS_BY_STATUS[expense.status].map((target) => (
                        <button
                          key={target}
                          type="button"
                          className={target === 'FINISHED' ? 'text-button' : 'buttonLink'}
                          disabled={busy}
                          onClick={() => onAction(expense, target)}
                        >
                          {busy && pending.target === target
                            ? PENDING_LABELS[target]
                            : ACTION_LABELS[target]}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
