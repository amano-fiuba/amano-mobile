import { useState } from 'react'
import { removeMember, removeSimulatedProfile, GROUPS_NETWORK_ERROR_MESSAGE } from '../../api/groupsClient'
import { useSnackbar } from '../Snackbar'
import ConfirmModal from '../ConfirmModal'

const ADMIN_TARGET_MESSAGE =
  'No podés eliminar directamente a otro administrador: primero quitale el rol'

/**
 * Confirmation modal before removal (FR-009): distinct handling for another
 * admin ("revoke the role first"), pending-debts and simulated-profile cases.
 * The group views render it with either a registered member (`member` prop)
 * or a `simulatedProfile` — both share the confirm step. Built on
 * ConfirmModal: another admin only gets the close button. On success it calls
 * `onRemoved` (the list updates by itself) and then `onClose`.
 */
export default function RemoveMemberDialog({ groupId, member, simulatedProfile, onRemoved, onClose }) {
  const showSnackbar = useSnackbar()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isAdminTarget = member?.role === 'ADMIN'
  const targetName = simulatedProfile?.name ?? member?.name ?? ''

  async function confirmRemove() {
    setBusy(true)
    setError('')
    const result = simulatedProfile
      ? await removeSimulatedProfile(groupId, simulatedProfile.profileId)
      : await removeMember(groupId, member.userId)
    if (!result || result.network) {
      setError(GROUPS_NETWORK_ERROR_MESSAGE)
    } else if (result.ok) {
      showSnackbar(`${targetName} ya no forma parte del grupo`)
      // the parent list re-fetches itself: no manual refresh (fix 2026-11-04)
      onRemoved?.()
      onClose?.()
      return
    } else {
      setError(result.detail || 'No se pudo eliminar')
    }
    setBusy(false)
  }

  const title = simulatedProfile ? 'Eliminar perfil simulado' : 'Eliminar miembro'
  const message = isAdminTarget
    ? ADMIN_TARGET_MESSAGE
    : `¿Seguro que querés eliminar ${simulatedProfile ? 'al perfil simulado' : 'a'} ${targetName}?`

  return (
    <ConfirmModal
      title={title}
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={isAdminTarget ? undefined : confirmRemove}
      testId="remove-member-dialog"
      errorTestId="remove-member-error"
    >
      <p data-testid={isAdminTarget ? 'remove-member-admin-hint' : 'remove-member-message'}>
        {message}
      </p>
    </ConfirmModal>
  )
}
