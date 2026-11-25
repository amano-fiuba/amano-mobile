import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { GROUPS_NETWORK_ERROR_MESSAGE, listGroups } from '../api/groupsClient'
import { memberCountLabel } from '../pages/groups/groupDisplay'
import { normalizeText } from '../validation/normalizeText'
import './ChoiceDialog.scss'
import '../pages/groups/groups.scss'
import ApiImage from './ApiImage'

export const GROUP_CHOOSER_TITLE = '¿En qué grupo?'
export const NO_GROUPS_MESSAGE = 'Todavía no formás parte de ningún grupo'
export const NO_GROUP_MATCHES_MESSAGE = 'No hay grupos que coincidan con la búsqueda.'
export const CANNOT_CREATE_IN_GROUP = 'No podés registrar gastos en este grupo'

/**
 * "Gasto grupal" from the quick actions (027, FR-021): the user's groups, shown
 * like "Mis grupos" (photo, members, chevron). Choosing one opens its "Nuevo
 * gasto" form; a group where the user cannot register expenses is greyed out,
 * without chevron and with the reason.
 */
export default function GroupChooserDialog({ onClose }) {
  const titleId = useId()
  const [state, setState] = useState({ status: 'loading', groups: [] })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    listGroups().then((result) => {
      if (!cancelled) {
        setState(result.ok ? { status: 'ready', groups: result.groups } : { status: 'error', groups: [] })
      }
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  const term = normalizeText(query.trim())
  const visible = state.groups.filter((group) => normalizeText(group.name).includes(term))
  const noGroups = state.status === 'ready' && state.groups.length === 0

  return createPortal(
    <div className="choice-dialog__backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="choice-dialog" onKeyDown={handleKeyDown}>
        <h3 id={titleId}>{GROUP_CHOOSER_TITLE}</h3>
        {!noGroups && (
          <div className="field">
            <label htmlFor={`${titleId}-search`}>Buscar grupo</label>
            <input
              ref={searchRef}
              id={`${titleId}-search`}
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}

        {state.status === 'loading' && (
          <p role="status" className="choice-dialog__status">
            Cargando grupos…
          </p>
        )}
        {state.status === 'error' && (
          <div className="choice-dialog__status">
            <p role="alert">{GROUPS_NETWORK_ERROR_MESSAGE}</p>
            <button
              type="button"
              className="choice-dialog__retry"
              onClick={() => {
                setState({ status: 'loading', groups: [] })
                setAttempt((value) => value + 1)
              }}
            >
              Reintentar
            </button>
          </div>
        )}
        {noGroups && (
          <div className="choice-dialog__status">
            <p>{NO_GROUPS_MESSAGE}</p>
            <Link to="/groups/new" onClick={onClose}>
              Crear grupo
            </Link>
          </div>
        )}
        {state.status === 'ready' && !noGroups && visible.length === 0 && (
          <p className="choice-dialog__status">{NO_GROUP_MATCHES_MESSAGE}</p>
        )}
        {state.status === 'ready' && visible.length > 0 && (
          <ul className="choice-dialog__list group-rows group-chooser__list" aria-label="Tus grupos">
            {visible.map((group) => {
              const allowed = group.canCreateExpenses !== false
              const content = (
                <>
                  {group.photo ? (
                    <ApiImage className="group-row__mark" src={group.photo} alt="" width={48} height={48} />
                  ) : (
                    <span className="group-row__mark" aria-hidden="true">
                      {group.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="group-row__body">
                    <strong>{group.name}</strong>
                    <small>{memberCountLabel(group.memberCount ?? 0)}</small>
                    {!allowed && <small className="group-chooser__blocked">{CANNOT_CREATE_IN_GROUP}</small>}
                  </span>
                </>
              )
              return (
                <li key={group.id}>
                  {allowed ? (
                    <Link className="group-row group-chooser__row" to={`/groups/${group.id}/expenses/new`} onClick={onClose}>
                      {content}
                      <span className="group-row__chevron" aria-hidden="true">›</span>
                    </Link>
                  ) : (
                    <div className="group-row group-chooser__row is-disabled" aria-disabled="true">
                      {content}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="choice-dialog__actions">
          <button type="button" className="choice-dialog__cancel" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
