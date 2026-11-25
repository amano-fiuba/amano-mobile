import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { getGroup } from '../../api/groupsClient'
import {
  GROUP_EXPENSE_DELETE_ERROR_MESSAGE,
  GROUP_EXPENSE_LOAD_ERROR_MESSAGE,
  deleteGroupExpense,
  getGroupExpense,
} from '../../api/groupExpensesClient'
import { useSnackbar } from '../../components/Snackbar'
import ExpenseDebtList from '../../components/groups/ExpenseDebtList'
import { formatAmount, formatIsoDate } from '../../validation/expenseFormat'

export const EXPENSE_NOT_FOUND_MESSAGE = 'No existe el gasto solicitado o no sos miembro del grupo'
export const DELETE_SUCCESS_MESSAGE = 'Gasto eliminado'
export const DELETE_CONFIRM_MESSAGE =
  '¿Seguro que querés eliminar este gasto? Esta acción no se puede deshacer.'

// Detail of a group expense with its shares and debts (specs/017-debt-states,
// US3, FR-020/FR-023/FR-025). Names are the copies stored with the expense, so
// a simulated profile removed later still shows up.
export default function GroupExpenseDetailView() {
  const { id, expenseId } = useParams()
  const auth = useAuth()
  const setUser = auth?.setUser
  const currentUserId = auth?.user?.id ?? null
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const [role, setRole] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  const [state, setState] = useState({ status: 'loading', expense: null, error: '' })

  // The caller's role only decides whether to offer edit/delete (T077); the
  // backend decides anyway, so a failure here just hides the actions for admins.
  useEffect(() => {
    let cancelled = false
    getGroup(id).then((result) => {
      if (!cancelled) setRole(result.ok ? result.group?.currentUserRole ?? null : null)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    getGroupExpense(id, expenseId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setState({ status: 'ready', expense: result.expense, error: '' })
        return
      }
      if (result.status === 401) {
        setUser?.(null)
        return
      }
      setState({
        status: 'error',
        expense: null,
        error: result.network ? GROUP_EXPENSE_LOAD_ERROR_MESSAGE : EXPENSE_NOT_FOUND_MESSAGE,
        retryable: Boolean(result.network),
      })
    })
    return () => {
      cancelled = true
    }
  }, [id, expenseId, retryToken, setUser])

  const { status, expense, error, retryable } = state
  const shares = Array.isArray(expense?.shares) ? expense.shares : []
  // 022 T077: only a personal expense (one share, no debts) can be edited or deleted,
  // by who registered it, its payer or an admin.
  const isPersonal = shares.length <= 1 && (expense?.debts?.length ?? 0) === 0
  const canManage =
    isPersonal &&
    (role === 'ADMIN' ||
      (currentUserId != null &&
        (expense?.createdBy?.userId === currentUserId || expense?.payer?.userId === currentUserId)))

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    const result = await deleteGroupExpense(id, expenseId)
    setDeleting(false)
    if (result.ok) {
      showSnackbar?.(DELETE_SUCCESS_MESSAGE)
      navigate(`/groups/${id}`)
      return
    }
    if (result.status === 401) {
      setUser?.(null)
      return
    }
    setConfirming(false)
    setDeleteError(
      result.network
        ? GROUP_EXPENSE_DELETE_ERROR_MESSAGE
        : result.detail || (result.status === 404 ? EXPENSE_NOT_FOUND_MESSAGE : GROUP_EXPENSE_DELETE_ERROR_MESSAGE),
    )
  }

  return (
    <main className="page group-page group-expense">
      <nav className="group-page__back">
        <Link to={`/groups/${id}`}>Volver al grupo</Link>
      </nav>

      {status === 'loading' && (
        <div role="status" className="group-expense__loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Cargando…</p>
        </div>
      )}

      {status === 'error' && (
        <div role="alert" data-testid="group-expense-detail-error">
          <p>{error}</p>
          {retryable && (
            <button
              type="button"
              onClick={() => {
                setState({ status: 'loading', expense: null, error: '' })
                setRetryToken((token) => token + 1)
              }}
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {status === 'ready' && expense && (
        <>
          <header className="group-card group-expense__header" data-testid="group-expense-detail">
            <h1>{expense.description || 'Gasto sin descripción'}</h1>
            <p className="group-expense__total">
              {expense.currency} $ {formatAmount(expense.amount)}
            </p>
            <p>
              {formatIsoDate(expense.date)} · Pagó {expense.payer?.name ?? 'alguien'}
            </p>
          </header>

          {canManage && (
            <section className="group-card group-expense__actions" aria-label="Acciones del gasto">
              <Link to={`/groups/${id}/expenses/${expenseId}/edit`} className="group-action">
                Editar gasto
              </Link>
              <button
                type="button"
                className="group-action"
                disabled={deleting}
                onClick={() => {
                  setDeleteError('')
                  setConfirming(true)
                }}
              >
                Eliminar gasto
              </button>
              {deleteError && (
                <p role="alert" data-testid="group-expense-delete-error">
                  {deleteError}
                </p>
              )}
              {confirming && (
                <div
                  role="dialog"
                  className="group-confirm"
                  aria-label="Eliminar gasto"
                  data-testid="delete-expense-dialog"
                >
                  <p>{DELETE_CONFIRM_MESSAGE}</p>
                  <button type="button" className="group-action" disabled={deleting} onClick={confirmDelete}>
                    Sí, eliminar
                  </button>{' '}
                  <button
                    type="button"
                    className="group-action"
                    disabled={deleting}
                    onClick={() => setConfirming(false)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </section>
          )}

          {expense.recurrence && (
            <section className="group-card" aria-label="Origen del gasto" data-testid="recurrence-origin">
              <h3>Origen</h3>
              {expense.recurrence.origin === 'SERIE' ? (
                <p>Este gasto dio origen a una serie recurrente</p>
              ) : (
                <p>
                  Gasto generado de la{' '}
                  <Link to={`/groups/${id}/expenses/${expense.recurrence.seriesId}`}>
                    serie recurrente
                  </Link>
                  {expense.recurrence.origin === 'SISTEMA' && ' · Creado automáticamente por el sistema'}
                  {expense.recurrence.origin === 'MIEMBRO' &&
                    ` · Creado al reanudar la serie por ${expense.createdBy?.name ?? 'un miembro'}`}
                </p>
              )}
            </section>
          )}

          <section className="group-card" aria-label="Partes del gasto">
            <h3>División</h3>
            <ul className="group-expense__shares">
              {shares.map((share) => (
                <li key={share.position} data-testid="share-row">
                  <span>
                    {share.name}
                    {share.isPayer && ' (pagó)'}
                  </span>
                  <span>$ {formatAmount(share.amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="group-card" aria-label="Deudas">
            <h3>Deudas</h3>
            <ExpenseDebtList
              debts={expense.debts}
              groupId={id}
              expenseId={expenseId}
              concept={expense.description}
              onStale={() => setRetryToken((token) => token + 1)}
            />
          </section>
        </>
      )}
    </main>
  )
}
