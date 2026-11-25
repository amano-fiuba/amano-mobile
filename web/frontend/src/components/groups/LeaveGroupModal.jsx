import ConfirmModal from '../ConfirmModal'

const MESSAGES = {
  confirm: '¿Seguro que querés abandonar el grupo?',
  'last-admin': 'Sos el último administrador: asigná otro administrador antes de salir',
  'last-member': 'Sos el último miembro: si confirmas, el grupo se eliminará',
}

/**
 * Leave-group modal (spec 020), built on ConfirmModal. It only renders one of
 * the three modes; the API call lives in LeaveGroupPanel. `last-admin` offers
 * no way out: just the close button.
 */
export default function LeaveGroupModal({ mode, busy = false, error = '', onConfirm, onClose }) {
  return (
    <ConfirmModal
      title="Salir del grupo"
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={mode === 'last-admin' ? undefined : onConfirm}
      testId="leave-group-dialog"
      errorTestId="leave-group-error"
    >
      <p data-testid="leave-group-message">{MESSAGES[mode]}</p>
    </ConfirmModal>
  )
}
