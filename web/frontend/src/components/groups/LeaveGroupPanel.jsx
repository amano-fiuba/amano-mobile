import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { leaveGroup, GROUPS_NETWORK_ERROR_MESSAGE } from '../../api/groupsClient'
import LeaveGroupModal from './LeaveGroupModal'
import { ExitIcon } from '../NavIcons'
import { useSnackbar } from '../Snackbar'

/**
 * Leave group (010 US5, spec 020): the "Salir" button opens a modal before POST
 * /api/groups/{id}/leave. The mode comes from the flags of the group detail,
 * but the server always rules: rejection motives are shown in the modal. On
 * success the user goes to the groups list (FR-015). The last member leaves
 * like anyone else (soft baja): no group record is deleted.
 */
export default function LeaveGroupPanel({ groupId, isLastAdmin = false, isLastMember = false }) {
  const navigate = useNavigate()
  const auth = useAuth()
  const showSnackbar = useSnackbar()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  let mode = 'confirm'
  if (isLastMember) mode = 'last-member'
  else if (isLastAdmin) mode = 'last-admin'

  function openModal() {
    setError('')
    setOpen(true)
  }

  async function confirmLeave() {
    setBusy(true)
    setError('')
    const result = await leaveGroup(groupId)
    setBusy(false)
    if (!result || result.network) {
      setError(GROUPS_NETWORK_ERROR_MESSAGE)
    } else if (result.ok) {
      showSnackbar(result.groupDeleted ? 'Se eliminó el grupo' : 'Se abandonó el grupo')
      // replace: "atrás" no debe volver a un grupo del que ya no se es miembro.
      navigate('/groups', { replace: true })
    } else if (result.status === 401) {
      auth?.setUser?.(null)
    } else {
      setError(result.detail || 'No se pudo abandonar el grupo')
    }
  }

  return (
    <section className="leave-group" data-testid="leave-group">
      <button type="button" className="group-action group-action--danger" onClick={openModal}>
        <ExitIcon /> Salir
      </button>
      {open && (
        <LeaveGroupModal
          mode={mode}
          busy={busy}
          error={error}
          onConfirm={confirmLeave}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}
