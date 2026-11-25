import { useState } from 'react'
import {
  grantAdminRole,
  revokeAdminRole,
  GROUPS_NETWORK_ERROR_MESSAGE,
} from '../../api/groupsClient'

const LAST_ADMIN_HINT = 'Sos el último administrador: asigná otro administrador antes de salir'

/**
 * Admin role management per group (US10): grant (POST …/admin) and revoke
 * (DELETE …/admin) are separate actions. Assignments are ADMIN-only (the
 * server rules); the grant action is hidden from non-admin members, and the
 * revoke action is disabled for the last admin with the explanatory message.
 */
export default function AdminRolePanel({ groupId, members, currentUserId, currentAdminIds }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const adminIds = new Set(currentAdminIds ?? [])
  const iAmAdmin = currentUserId != null && adminIds.has(currentUserId)
  const isLastAdmin = adminIds.size <= 1

  async function changeRole(action, userId) {
    setBusy(true)
    setError('')
    setStatus('')
    const result = action === 'grant'
      ? await grantAdminRole(groupId, userId)
      : await revokeAdminRole(groupId, userId)
    if (!result || result.network) {
      setError(GROUPS_NETWORK_ERROR_MESSAGE)
    } else if (result.ok) {
      setStatus(
        action === 'grant'
          ? 'La persona ahora es administradora del grupo'
          : 'La persona volvió a ser miembro del grupo',
      )
    } else {
      setError(result.detail || 'No se pudo cambiar el rol')
    }
    setBusy(false)
  }

  return (
    <section data-testid="admin-roles">
      {!iAmAdmin && <p>Solo un administrador puede asignar o quitar el rol de administrador.</p>}
      {isLastAdmin && (
        <p role="alert" data-testid="admin-roles-last-admin-hint">
          {LAST_ADMIN_HINT}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {error && (
        <p role="alert" data-testid="admin-roles-error">
          {error}
        </p>
      )}
      <ul>
        {members.map((member) => {
          const isAdmin = adminIds.has(member.userId)
          const revokeable = isAdmin && adminIds.size > 1
          return (
            <li key={member.userId}>
              {member.name} · {isAdmin ? 'Administrador' : 'Miembro'}
              {member.userId !== currentUserId && (
                <>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busy || !revokeable}
                      aria-label={
                        revokeable
                          ? `Quitar admin a ${member.name}`
                          : 'Último admin: no puede perder el rol'
                      }
                      onClick={() => changeRole('revoke', member.userId)}
                    >
                      {revokeable ? `Quitar admin a ${member.name}` : 'Último admin'}
                    </button>
                  )}
                  {!isAdmin && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Asignar admin a ${member.name || 'la persona'}`}
                      onClick={() => changeRole('grant', member.userId)}
                    >
                      Asignar admin
                    </button>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
