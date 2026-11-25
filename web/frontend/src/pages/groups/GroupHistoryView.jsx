import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getActivity } from '../../api/groupsClient'
import { useAuth } from '../../auth/AuthContext'
import {
  ACTIVITY_FILTERS,
  deletedExpenseIds,
  describeActivity,
  expenseLinkId,
  formatTime,
  groupByDay,
} from './activityDescriptions'

// Mensajes fijos de la pantalla (specs/014-group-activity-history,
// contracts/activity-api.md), exportados para las pruebas.
export const PAGE_SIZE = 20
export const NO_ACTIVITY_MESSAGE = 'Todavía no hay actividad en este grupo'
export const NO_FILTERED_ACTIVITY_MESSAGE = 'No hay actividad de este tipo en el grupo'
export const HISTORY_ERROR_MESSAGE = 'No se pudo cargar el historial. Intentá nuevamente'
export const NOT_A_MEMBER_MESSAGE = 'No existe el grupo solicitado o no sos miembro'

function initialFilter(value) {
  return ACTIVITY_FILTERS.some((option) => option.value === value) ? value : 'ALL'
}

// Historial de actividad del grupo (010 US9; 014 US1–US3): frases completas
// agrupadas por día, filtro "Mostrar", paginación y estados de carga, vacío y
// error. Una respuesta vieja nunca pisa a la consulta más reciente.

export default function GroupHistoryView({ groupId }) {
  const auth = useAuth()
  const setUser = auth?.setUser
  const [searchParams, setSearchParams] = useSearchParams()
  // 017 FR-024: "?filter=EXPENSES" opens the history already filtered; unknown
  // values fall back to all the activity.
  const [filter, setFilter] = useState(() => initialFilter(searchParams.get('filter')))
  const [page, setPage] = useState(1)
  const [retryToken, setRetryToken] = useState(0)
  const [state, setState] = useState({ status: 'loading', entries: [], totalPages: 0, error: '' })

  useEffect(() => {
    let cancelled = false
    const { eventTypes } = ACTIVITY_FILTERS.find((option) => option.value === filter)

    getActivity(groupId, { page, size: PAGE_SIZE, eventTypes }).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setState({
          status: 'ready',
          entries: Array.isArray(result.content) ? result.content : [],
          totalPages: result.totalPages ?? 0,
          error: '',
        })
        return
      }
      if (result.status === 401) {
        setUser?.(null)
        return
      }
      const error = result.network
        ? HISTORY_ERROR_MESSAGE
        : result.detail || NOT_A_MEMBER_MESSAGE
      setState({ status: 'error', entries: [], totalPages: 0, error, retryable: Boolean(result.network) })
    })

    return () => {
      cancelled = true
    }
  }, [groupId, filter, page, retryToken, setUser])

  function reload(changes) {
    setState((previous) => ({ ...previous, status: 'loading', error: '' }))
    changes()
  }

  function changeFilter(event) {
    const value = event.target.value
    reload(() => {
      setFilter(value)
      setPage(1)
      setSearchParams(value === 'ALL' ? {} : { filter: value }, { replace: true })
    })
  }

  const { status, entries, totalPages, error, retryable } = state
  const days = groupByDay(entries)
  const deletedIds = deletedExpenseIds(entries)
  const lastPage = Math.max(totalPages, 1)

  return (
    <main className="page group-page group-history">
      <nav className="group-page__back">
        <Link to={`/groups/${groupId}`}>Volver al grupo</Link>
      </nav>

      <header className="group-history__header">
        <h1>Historial de actividad</h1>
        <label className="group-history__filter">
          <span>Mostrar</span>
          <select value={filter} onChange={changeFilter} aria-label="Mostrar">
            {ACTIVITY_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {status === 'loading' && (
        <div className="group-history__loading" role="status">
          <span className="button-spinner" aria-hidden="true" />
          <p>Cargando historial…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="group-history__error" role="alert" data-testid="history-error">
          <p>{error}</p>
          {retryable && (
            <button type="button" onClick={() => reload(() => setRetryToken((token) => token + 1))}>
              Reintentar
            </button>
          )}
        </div>
      )}

      {status === 'ready' && entries.length === 0 && (
        <p className="group-history__empty" role="status">
          {filter === 'ALL' ? NO_ACTIVITY_MESSAGE : NO_FILTERED_ACTIVITY_MESSAGE}
        </p>
      )}

      {status === 'ready' && entries.length > 0 && (
        <div data-testid="history-list">
          {days.map((day) => (
            <section key={day.key} className="group-card group-history__day" aria-label={day.label}>
              <h2 className="group-history__day-title">{day.label}</h2>
              <ol className="group-history__entries">
                {day.entries.map((entry) => {
                  const { actor, text } = describeActivity(entry)
                  const linkedExpenseId = expenseLinkId(entry, deletedIds)
                  return (
                    <li
                      key={entry.id}
                      className={`group-history__entry group-history__entry--${String(entry.eventType).toLowerCase()}`}
                      data-testid="activity-entry"
                    >
                      <p>
                        <strong>{actor}</strong> {text}
                      </p>
                      {linkedExpenseId != null && (
                        <Link
                          to={`/groups/${groupId}/expenses/${linkedExpenseId}`}
                          className="group-history__expense-link"
                        >
                          Ver gasto
                        </Link>
                      )}
                      <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {status === 'ready' && totalPages > 1 && (
        <nav className="group-history__pagination" aria-label="Paginación del historial">
          {page > 1 && (
            <button type="button" onClick={() => reload(() => setPage(page - 1))}>
              Anterior
            </button>
          )}
          <span>
            Página {page} de {lastPage}
          </span>
          {page < lastPage && (
            <button type="button" onClick={() => reload(() => setPage(page + 1))}>
              Siguiente
            </button>
          )}
        </nav>
      )}
    </main>
  )
}
