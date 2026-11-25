import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FRIENDS_NETWORK_ERROR_MESSAGE, listFriends } from '../../api/friendsClient'
import { useAuth } from '../../auth/AuthContext'
import { NO_FRIENDS_MESSAGE } from '../FriendsList'
import { normalizeText as normalize } from '../../validation/normalizeText'
import ApiImage from '../ApiImage'

const DEFAULT_AVATAR = '/avatar-default.png'

function fullName(friend) {
  return friend.lastName ? `${friend.firstName} ${friend.lastName}` : friend.firstName
}

function matches(friend, term) {
  return [fullName(friend), friend.email].some((value) => normalize(value).includes(term))
}

/**
 * Friends list (spec 023 FR-023, FR-024, FR-027) with the same rows as the
 * "Agregar miembro" modal: "Agregar" on each friend and "Agregado" once chosen.
 * The chosen ones are removed from the chips that CreateGroupView shows above
 * (PeopleChips), which stay visible even while the list is filtered. The
 * filter runs on the already loaded list, and `selected` lives in the parent so
 * it survives the filter.
 */
export default function FriendPicker({ selected, onChange }) {
  const { setUser } = useAuth()
  const [friends, setFriends] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryToken, setRetryToken] = useState(0)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false

    listFriends().then((result) => {
      if (cancelled) return
      setIsLoading(false)
      if (result.ok) {
        setError(null)
        setFriends(result.friends)
      } else if (result.status === 401) {
        setUser(null)
      } else {
        setError(FRIENDS_NETWORK_ERROR_MESSAGE)
      }
    })

    return () => {
      cancelled = true
    }
  }, [retryToken, setUser])

  function retry() {
    setIsLoading(true)
    setError(null)
    setRetryToken((token) => token + 1)
  }

  function toggle(friend) {
    const isSelected = selected.some(({ id }) => id === friend.id)
    onChange(isSelected ? selected.filter(({ id }) => id !== friend.id) : [...selected, friend])
  }

  if (isLoading) {
    return <p className="friend-picker__status" role="status">Cargando tus amigos…</p>
  }

  if (error) {
    return (
      <div className="friend-picker__status">
        <p role="alert">{error}</p>
        <button type="button" className="group-action" onClick={retry}>
          Reintentar
        </button>
      </div>
    )
  }

  if (friends.length === 0) {
    return (
      <p className="friend-picker__status">
        {NO_FRIENDS_MESSAGE}. <Link to="/users/search">Buscar personas</Link>
      </p>
    )
  }

  const term = normalize(filter.trim())
  const visible = friends.filter((friend) => matches(friend, term))

  return (
    <div className="friend-picker">
      <label className="friend-picker__filter">
        <span>Buscar entre tus amigos</span>
        <input
          type="search"
          placeholder="Nombre o correo"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </label>
      {visible.length === 0 ? (
        <p className="friend-picker__status" role="status">
          Ningún amigo coincide con tu búsqueda
        </p>
      ) : (
        <ul className="add-members__list" aria-label="Tus amigos">
          {visible.map((friend) => {
            const isSelected = selected.some(({ id }) => id === friend.id)
            return (
              <li
                key={friend.id}
                className={isSelected ? 'add-members__row is-member' : 'add-members__row'}
              >
                <ApiImage src={friend.avatarUrl || DEFAULT_AVATAR} alt="" width={36} height={36} />
                <span className="add-members__identity">
                  <strong>{fullName(friend)}</strong>
                  <span>{friend.email}</span>
                </span>
                {isSelected ? (
                  <span className="add-members__added">Agregado</span>
                ) : (
                  <button
                    type="button"
                    className="group-action"
                    aria-label={`Agregar a ${fullName(friend)}`}
                    onClick={() => toggle(friend)}
                  >
                    Agregar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
