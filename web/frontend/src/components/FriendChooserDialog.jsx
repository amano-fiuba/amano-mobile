import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { FRIENDS_NETWORK_ERROR_MESSAGE, listFriends } from '../api/friendsClient'
import { NO_FRIENDS_MESSAGE } from './FriendsList'
import { friendName } from '../validation/friendName'
import { normalizeText } from '../validation/normalizeText'
import './ChoiceDialog.scss'
import '../pages/groups/groups.scss'
import ApiImage from './ApiImage'

export const FRIEND_CHOOSER_TITLE = '¿Con qué amigo?'
export const NO_FRIEND_MATCHES_MESSAGE = 'Ningún amigo coincide con tu búsqueda.'
const DEFAULT_AVATAR = '/avatar-default.png'

/**
 * "Gasto con amigo" from the quick actions (027, FR-030): exactly one friend of
 * the user's list, shown like the group chooser rows; choosing one opens
 * /friends/:friendId/expenses/new.
 */
export default function FriendChooserDialog({ onClose }) {
  const titleId = useId()
  const [state, setState] = useState({ status: 'loading', friends: [] })
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    listFriends().then((result) => {
      if (!cancelled) {
        setState(
          result.ok && Array.isArray(result.friends)
            ? { status: 'ready', friends: result.friends }
            : { status: 'error', friends: [] },
        )
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
  const visible = state.friends.filter((friend) =>
    [friendName(friend), friend.email].some((text) => normalizeText(text).includes(term)),
  )
  const noFriends = state.status === 'ready' && state.friends.length === 0

  return createPortal(
    <div className="choice-dialog__backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="choice-dialog" onKeyDown={handleKeyDown}>
        <h3 id={titleId}>{FRIEND_CHOOSER_TITLE}</h3>
        {!noFriends && (
          <div className="field">
            <label htmlFor={`${titleId}-search`}>Buscar amigo</label>
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
            Cargando tus amigos…
          </p>
        )}
        {state.status === 'error' && (
          <div className="choice-dialog__status">
            <p role="alert">{FRIENDS_NETWORK_ERROR_MESSAGE}</p>
            <button
              type="button"
              className="choice-dialog__retry"
              onClick={() => {
                setState({ status: 'loading', friends: [] })
                setAttempt((value) => value + 1)
              }}
            >
              Reintentar
            </button>
          </div>
        )}
        {noFriends && (
          <div className="choice-dialog__status">
            <p>{NO_FRIENDS_MESSAGE}</p>
            <Link to="/users/search" onClick={onClose}>
              Buscar usuarios
            </Link>
          </div>
        )}
        {state.status === 'ready' && !noFriends && visible.length === 0 && (
          <p className="choice-dialog__status">{NO_FRIEND_MATCHES_MESSAGE}</p>
        )}
        {state.status === 'ready' && visible.length > 0 && (
          <ul className="choice-dialog__list group-rows group-chooser__list" aria-label="Tus amigos">
            {visible.map((friend) => (
              <li key={friend.id}>
                <Link className="group-row group-chooser__row" to={`/friends/${friend.id}/expenses/new`} onClick={onClose}>
                  <ApiImage className="group-row__mark friend-chooser__avatar" src={friend.avatarUrl || DEFAULT_AVATAR} alt="" width={40} height={40} />
                  <span className="group-row__body">
                    <strong>{friendName(friend)}</strong>
                    <small>{friend.email}</small>
                  </span>
                  <span className="group-row__chevron" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
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
