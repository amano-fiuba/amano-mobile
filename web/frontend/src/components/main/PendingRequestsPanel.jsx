import { useState } from 'react'
import { Link } from 'react-router'
import {
  RECEIVED_NETWORK_ERROR_MESSAGE,
  RESPOND_NETWORK_ERROR_MESSAGE,
  listReceivedFriendshipRequests,
  respondFriendshipRequest,
} from '../../api/friendsClient'
import { useAuth } from '../../auth/AuthContext'
import { useSessionData } from '../../hooks/useSessionData'
import { ACCEPTED_MESSAGE, REJECTED_MESSAGE } from '../../pages/FriendsPage'
import { useSnackbar } from '../Snackbar'

const VISIBLE_REQUESTS = 3

function fullName({ firstName, lastName }) {
  return lastName ? `${firstName} ${lastName}` : firstName
}

// Solicitudes pendientes con las reglas de 012: la fila sale con 200/404/409 y
// se conserva ante un fallo de red.
export default function PendingRequestsPanel() {
  const { setUser } = useAuth()
  const showSnackbar = useSnackbar()
  const [{ status, items }, setState] = useSessionData(
    listReceivedFriendshipRequests,
    'requests',
  )
  const [respondingId, setRespondingId] = useState(null)
  const [error, setError] = useState('')

  const handleRespond = async (request, action) => {
    setRespondingId(request.id)
    setError('')
    const result = await respondFriendshipRequest(request.id, action)
    setRespondingId(null)
    if (result.status === 401) {
      setUser(null)
      return
    }
    if (result.ok || result.status === 404 || result.status === 409) {
      setState((previous) => ({
        ...previous,
        items: previous.items.filter((item) => item.id !== request.id),
      }))
    }
    if (result.ok) {
      showSnackbar(action === 'ACCEPT' ? ACCEPTED_MESSAGE : REJECTED_MESSAGE)
    } else {
      setError(result.detail || RESPOND_NETWORK_ERROR_MESSAGE)
    }
  }

  return (
    <section className="main-card" aria-labelledby="main-requests-title">
      <div className="main-card__header">
        <h2 id="main-requests-title">Solicitudes de amistad</h2>
        {items.length > VISIBLE_REQUESTS && <Link to="/friends">Ver todas</Link>}
      </div>

      {status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {status === 'error' && <p role="alert">{RECEIVED_NETWORK_ERROR_MESSAGE}</p>}
      {error && <p role="alert">{error}</p>}
      {status === 'ready' && items.length === 0 && <p>No tenés solicitudes pendientes</p>}
      {items.length > 0 && (
        <ul className="main-list">
          {items.slice(0, VISIBLE_REQUESTS).map((request) => (
            <li key={request.id} className="main-request">
              <strong>{fullName(request.sender)}</strong>
              <small>{request.sender.email}</small>
              <div>
                <button
                  type="button"
                  disabled={respondingId !== null}
                  aria-label={`Aceptar a ${fullName(request.sender)}`}
                  onClick={() => handleRespond(request, 'ACCEPT')}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="main-request__reject"
                  disabled={respondingId !== null}
                  aria-label={`Rechazar a ${fullName(request.sender)}`}
                  onClick={() => handleRespond(request, 'REJECT')}
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
