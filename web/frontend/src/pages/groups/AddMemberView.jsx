import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { addMember, getMembers, GROUPS_NETWORK_ERROR_MESSAGE } from '../../api/groupsClient'
import { FRIENDS_NETWORK_ERROR_MESSAGE, listFriends } from '../../api/friendsClient'
import ConfirmModal from '../../components/ConfirmModal'
import ListSearch from '../../components/ListSearch'
import { NO_FRIENDS_MESSAGE } from '../../components/FriendsList'
import { useSnackbar } from '../../components/Snackbar'
import { filterPeople, fullName } from '../../utils/personSearch'
import ApiImage from '../../components/ApiImage'

const DEFAULT_AVATAR = '/avatar-default.png'
export const CANNOT_INVITE_MESSAGE = 'No podés invitar gente a este grupo'
export const NO_FRIEND_MATCHES_MESSAGE = 'Ningún amigo coincide con tu búsqueda'

/**
 * Modal "Agregar amigos a {grupo}" (abierto desde "Agregar miembro"). Lista a
 * todos los amigos, con un buscador por nombre o mail que filtra mientras se
 * escribe. Quienes ya son miembros figuran sombreados con "Agregado"; el resto
 * tiene "Agregar". El modal queda abierto para seguir agregando, y al pie se
 * puede sumar un perfil simulado. La lista sale de GET /api/users/me/friends y
 * se filtra en el navegador; el alta (POST /members) sigue validando en el
 * servidor que sea amigo, que no sea miembro y el permiso de invitar.
 * `onAdded` hace que la pantalla del grupo vuelva a consultar los miembros.
 */
export default function AddMemberView({ group, permissions, onAdded, onClose }) {
  const showSnackbar = useSnackbar()
  const [friends, setFriends] = useState(null)
  const [memberIds, setMemberIds] = useState(() => new Set())
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [search, setSearch] = useState('')
  const [addingId, setAddingId] = useState(null)
  const [showSimulated, setShowSimulated] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [simulatedBusy, setSimulatedBusy] = useState(false)
  const [error, setError] = useState('')

  const canInvite = !permissions?.membersCannotInvite

  useEffect(() => {
    let cancelled = false
    Promise.all([listFriends(), getMembers(group.id)]).then(([friendsResult, membersResult]) => {
      if (cancelled) return
      if (!friendsResult.ok) {
        setLoadError(FRIENDS_NETWORK_ERROR_MESSAGE)
        return
      }
      setLoadError('')
      setFriends(friendsResult.friends)
      // Sin la lista de miembros, todos figuran con "Agregar": el servidor
      // igual rechaza a quien ya es miembro y el motivo se muestra.
      if (membersResult?.ok) {
        setMemberIds(new Set(membersResult.members.map((m) => m.userId).filter((id) => id != null)))
      }
    })
    return () => {
      cancelled = true
    }
  }, [group.id, reloadToken])

  function retry() {
    setLoadError('')
    setFriends(null)
    setReloadToken((token) => token + 1)
  }

  async function addFriend(friend) {
    setError('')
    setAddingId(friend.id)
    const result = await addMember(group.id, {
      memberType: 'REGISTERED',
      identifier: friend.email,
    })
    setAddingId(null)
    if (!result || result.network) {
      setError(GROUPS_NETWORK_ERROR_MESSAGE)
      return
    }
    if (result.ok) {
      setMemberIds((previous) => new Set(previous).add(friend.id))
      showSnackbar(`Miembro agregado: ${fullName(friend)}`)
      onAdded?.()
    } else {
      setError(result.detail || 'No se pudo agregar al miembro')
    }
  }

  async function addSimulated(event) {
    event.preventDefault()
    setError('')
    if (!profileName.trim() || !profileEmail.trim()) {
      setError('Ingresá nombre y correo del perfil simulado')
      return
    }
    setSimulatedBusy(true)
    const result = await addMember(group.id, {
      memberType: 'SIMULATED',
      identifier: profileEmail.trim(),
      name: profileName.trim(),
    })
    setSimulatedBusy(false)
    if (!result || result.network) {
      setError(GROUPS_NETWORK_ERROR_MESSAGE)
      return
    }
    if (result.ok) {
      showSnackbar(`Miembro agregado: ${profileName.trim()}`)
      setProfileName('')
      setProfileEmail('')
      setShowSimulated(false)
      onAdded?.()
    } else {
      setError(result.detail || 'No se pudo agregar al miembro')
    }
  }

  const visibleFriends = friends ? filterPeople(friends, search) : []

  return (
    <ConfirmModal
      title={`Agregar amigos a ${group.name}`}
      onClose={onClose}
      error={error}
      errorTestId="add-member-error"
      testId="add-member-dialog"
      wide
      describedByBody={false}
    >
      <div className="add-members">
        {!canInvite && <p role="alert">{CANNOT_INVITE_MESSAGE}</p>}

        {friends === null && !loadError && (
          <p className="add-members__status" role="status">
            Cargando tus amigos…
          </p>
        )}

        {loadError && (
          <div className="add-members__status">
            <p role="alert">{loadError}</p>
            <button type="button" className="group-action" onClick={retry}>
              Reintentar
            </button>
          </div>
        )}

        {friends?.length === 0 && (
          <p className="add-members__status">
            {NO_FRIENDS_MESSAGE}. <Link to="/users/search">Buscar usuarios</Link>
          </p>
        )}

        {friends?.length > 0 && (
          <>
            <ListSearch label="Buscar entre tus amigos" value={search} onChange={setSearch} />
            {visibleFriends.length === 0 ? (
              <p className="add-members__status" role="status">
                {NO_FRIEND_MATCHES_MESSAGE}
              </p>
            ) : (
              <ul className="add-members__list" aria-label="Tus amigos">
                {visibleFriends.map((friend) => {
                  const isMember = memberIds.has(friend.id)
                  return (
                    <li
                      key={friend.id}
                      className={isMember ? 'add-members__row is-member' : 'add-members__row'}
                      data-testid={`add-friend-${friend.id}`}
                    >
                      <ApiImage src={friend.avatarUrl || DEFAULT_AVATAR} alt="" width={36} height={36} />
                      <span className="add-members__identity">
                        <strong>{fullName(friend)}</strong>
                        <span>{friend.email}</span>
                      </span>
                      {isMember ? (
                        <span className="add-members__added">Agregado</span>
                      ) : (
                        <button
                          type="button"
                          className="group-action"
                          aria-label={`Agregar a ${fullName(friend)}`}
                          disabled={!canInvite || addingId !== null}
                          onClick={() => addFriend(friend)}
                        >
                          {addingId === friend.id ? 'Agregando…' : 'Agregar'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        <div className="add-members__simulated">
          {showSimulated ? (
            <form data-testid="simulated-form" onSubmit={addSimulated}>
              <label htmlFor="simulated-name">Nombre del perfil simulado</label>
              <input
                id="simulated-name"
                type="text"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
              />
              <label htmlFor="simulated-email">Correo del perfil simulado</label>
              <input
                id="simulated-email"
                type="text"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
              />
              <button type="submit" disabled={!canInvite || simulatedBusy}>
                Agregar perfil simulado
              </button>
            </form>
          ) : (
            <p>
              ¿No tiene cuenta?{' '}
              <button
                type="button"
                className="text-button"
                onClick={() => setShowSimulated(true)}
              >
                Agregar perfil simulado
              </button>
            </p>
          )}
        </div>
      </div>
    </ConfirmModal>
  )
}
