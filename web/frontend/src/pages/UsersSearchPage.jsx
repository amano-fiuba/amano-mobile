import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import TextField from '../components/TextField'
import { SEARCH_NETWORK_ERROR_MESSAGE, searchUsers } from '../api/usersClient'
import { SEND_NETWORK_ERROR_MESSAGE, sendFriendshipRequest } from '../api/friendsClient'
import { useAuth } from '../auth/AuthContext'
import { useSnackbar } from '../components/Snackbar'
import HomeLink from '../components/HomeLink'
import ApiImage from '../components/ApiImage'

// Exact messages of the spec (FR-009, FR-016, FR-017), exported for the tests.
export const TOO_SHORT_MESSAGE = 'Ingresá al menos 2 caracteres para buscar'
export const NO_RESULTS_MESSAGE = 'No se encontraron usuarios'
export const FRIENDSHIP_REQUEST_SENT_MESSAGE = 'Solicitud de amistad enviada'

const MIN_LENGTH = 2
// Pausa antes de buscar mientras se escribe (igual que el buscador de la barra).
const DEBOUNCE_MS = 300
const DEFAULT_AVATAR = '/avatar-default.png'

function fullName(user) {
  return user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName
}

function resultsLabel(count) {
  return count === 1 ? '1 resultado' : `${count} resultados`
}

// Inline icons keep the page self-contained and inherit the palette through
// currentColor (same visual language as the register form controls).
function SearchIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  )
}

function UserPlusIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  )
}

function UserClockIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8" cy="7" r="4" />
      <circle cx="18" cy="14" r="4" />
      <path d="M18 12.5V14l1 1" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

// User search screen (feature 008). Searches while typing, after a short
// pause, once the term has 2+ characters (replaces the "Buscar" button of
// 008 FR-001b). Enter searches right away. Outcomes:
//  - < 2 chars after trimming → while typing, nothing (the hint already says
//    "Mínimo 2 caracteres."); on Enter, the notice of FR-004/FR-017
//  - empty term → back to the initial state
//  - 200 → list (or "No se encontraron usuarios")
//  - 400 → the server's field message
//  - 401 → session cleared; ProtectedRoute sends the user to /login
//  - network/5xx → fixed retry message (FR-010)
// Previous results are always cleared when a search starts or fails, and only
// the latest request's answer is shown (out-of-order answers are ignored).
function UsersSearch({ initialTerm }) {
  const { setUser } = useAuth()
  const showSnackbar = useSnackbar()
  const [term, setTerm] = useState(initialTerm)
  const [results, setResults] = useState([])
  const [notice, setNotice] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [sentIds, setSentIds] = useState([])
  const [sendError, setSendError] = useState('')
  const latestRequest = useRef(0)
  // Term already searched with Enter: the pending search-as-you-type for that
  // same term is skipped (no duplicate request, and the too-short notice of
  // Enter is not cleared a moment later).
  const submittedTerm = useRef(null)

  const showError = (text, title) => {
    setNotice({ kind: 'error', text, title })
  }

  // Sends a friendship request (feature 011, US1/US2/US4). The row keeps its own
  // sent state during this screen session; after a reload the search reports it
  // through `friendshipStatus` (spec 021).
  const handleAdd = async (user) => {
    if (sendingId !== null || sentIds.includes(user.id)) {
      return
    }
    setSendingId(user.id)
    setSendError('')

    let result
    try {
      result = await sendFriendshipRequest(user.id)
    } catch {
      result = { ok: false, network: true }
    }

    setSendingId(null)

    if (result.ok) {
      setSentIds((ids) => (ids.includes(user.id) ? ids : [...ids, user.id]))
      showSnackbar(FRIENDSHIP_REQUEST_SENT_MESSAGE)
      return
    }

    if (result.status === 401) {
      setUser(null)
      return
    }

    setSendError(result.fields?.recipientId || result.detail || SEND_NETWORK_ERROR_MESSAGE)
  }

  const runSearch = async (rawTerm) => {
    const trimmed = rawTerm.trim()

    // Every submission invalidates any in-flight request, including an invalid
    // term (otherwise an older answer could overwrite the validation notice).
    latestRequest.current += 1
    const requestId = latestRequest.current

    if (trimmed.length < MIN_LENGTH) {
      setIsSearching(false)
      setResults([])
      showError(TOO_SHORT_MESSAGE, 'Revisá el término de búsqueda')
      return
    }

    setNotice(null)
    setSendError('')
    setResults([])
    setIsSearching(true)

    let result
    try {
      result = await searchUsers(trimmed)
    } catch {
      // searchUsers already maps failures to {ok:false}; this is a safety net.
      result = { ok: false, network: true }
    }

    if (requestId !== latestRequest.current) {
      return // a newer search was started meanwhile
    }
    setIsSearching(false)

    if (result.ok) {
      if (result.users.length === 0) {
        setNotice({ kind: 'empty', text: NO_RESULTS_MESSAGE })
      } else {
        setResults(result.users)
      }
      return
    }

    if (result.status === 401) {
      setUser(null)
      return
    }
    if (result.status === 400 && result.fields?.q) {
      showError(result.fields.q, 'Revisá el término de búsqueda')
      return
    }
    showError(SEARCH_NETWORK_ERROR_MESSAGE, 'No pudimos completar la búsqueda')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submittedTerm.current = term
    runSearch(term)
  }

  // Search as you type. Also covers the ?q= of the top bar's global search
  // (specs/015-main-screen, FR-006): the first run uses the initial term.
  const searchTypedTerm = useEffectEvent((typed) => {
    if (submittedTerm.current === typed) {
      return
    }
    const trimmed = typed.trim()
    if (trimmed.length >= MIN_LENGTH) {
      runSearch(typed)
      return
    }
    // Too short or empty: drop any in-flight answer and show the initial state.
    latestRequest.current += 1
    setIsSearching(false)
    setResults([])
    setNotice(null)
  })

  useEffect(() => {
    const timer = setTimeout(() => searchTypedTerm(term), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [term])

  return (
    <main className="page users-search-page">
      <header className="users-search-page__header">
        <HomeLink />
        <h1>Buscar usuarios</h1>
        <p className="users-search-page__lead">
          Encontrá personas por su nombre, apellido o correo electrónico.
        </p>
      </header>

      <form
        className="users-search-form"
        onSubmit={handleSubmit}
        noValidate
        role="search"
        aria-busy={isSearching || undefined}
      >
        <div className="users-search-form__row">
          <TextField
            label="Buscar usuarios"
            hideLabel
            type="search"
            placeholder="Buscá por nombre, apellido o correo"
            autoComplete="off"
            enterKeyHint="search"
            leadingIcon={<SearchIcon />}
            value={term}
            onChange={(event) => {
              submittedTerm.current = null
              setTerm(event.target.value)
            }}
          />
        </div>
        <p className="users-search-form__hint">Mínimo 2 caracteres.</p>
      </form>

      {isSearching && (
        <div className="users-search-loading" role="status" data-testid="search-loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Buscando usuarios…</p>
        </div>
      )}

      {notice?.kind === 'error' && (
        <div className="users-search-banner" role="alert" data-testid="search-notice">
          <span className="users-search-banner__icon">
            <AlertIcon />
          </span>
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.text}</p>
          </div>
        </div>
      )}

      {notice?.kind === 'empty' && (
        <section className="users-search-empty" role="status" data-testid="search-notice">
          <span className="users-search-empty__icon">
            <SearchIcon />
          </span>
          <h2>{NO_RESULTS_MESSAGE}</h2>
          <p>Probá con otro nombre, apellido o correo.</p>
        </section>
      )}

      {!isSearching && !notice && results.length === 0 && (
        <section
          className="users-search-empty users-search-empty--initial"
          data-testid="search-initial"
        >
          <span className="users-search-empty__icon">
            <SearchIcon />
          </span>
          <h2>Encontrá personas</h2>
          <p>Ingresá un término de búsqueda para ver las coincidencias acá.</p>
        </section>
      )}

      {results.length > 0 && (
        <section className="users-search__results" aria-labelledby="users-search-results-title">
          <div className="users-search__results-header">
            <h2 id="users-search-results-title">Resultados</h2>
            <span className="users-search__count" aria-live="polite">
              {resultsLabel(results.length)}
            </span>
          </div>
          {sendError && (
            <p
              className="users-search__send-feedback users-search__send-feedback--error"
              role="alert"
              data-testid="friendship-feedback"
            >
              {sendError}
            </p>
          )}
          <ul className="user-results" aria-label="Resultados de la búsqueda">
            {results.map((user) => {
              const name = fullName(user)
              const isSending = sendingId === user.id
              const wasSent = sentIds.includes(user.id) || user.friendshipStatus === 'PENDING_SENT'
              const isPendingReceived = user.friendshipStatus === 'PENDING_RECEIVED'
              const isFriend = user.friendshipStatus === 'FRIENDS'
              return (
                <li key={user.id} className="user-card" data-testid={`user-card-${user.id}`}>
                  <ApiImage
                    className="user-card__avatar"
                    src={user.avatarUrl || DEFAULT_AVATAR}
                    alt=""
                    width={44}
                    height={44}
                  />
                  <div className="user-card__identity">
                    <strong>{name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button
                    type="button"
                    className="user-card__action"
                    onClick={() => handleAdd(user)}
                    disabled={isSending || wasSent || isPendingReceived || isFriend}
                    aria-label={
                      isFriend
                        ? `${name} ya es tu amigo`
                        : isPendingReceived
                          ? `Solicitud pendiente de ${name}`
                          : wasSent
                            ? `Solicitud enviada a ${name}`
                            : isSending
                              ? `Enviando solicitud a ${name}`
                              : `Agregar a ${name}`
                    }
                  >
                    {isFriend ? (
                      <UsersIcon />
                    ) : isPendingReceived || wasSent ? (
                      <UserClockIcon />
                    ) : (
                      <UserPlusIcon />
                    )}
                    {isFriend
                      ? 'Amigos'
                      : isPendingReceived
                        ? 'Pendiente'
                        : isSending
                          ? 'Enviando…'
                          : wasSent
                            ? 'Solicitud enviada'
                            : 'Agregar'}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </main>
  )
}

// Keyed by the term so a new global search restarts the screen.
export default function UsersSearchPage() {
  const [searchParams] = useSearchParams()
  const initialTerm = searchParams.get('q') ?? ''
  return <UsersSearch key={initialTerm} initialTerm={initialTerm} />
}
