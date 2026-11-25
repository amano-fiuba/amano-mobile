import ConfirmModal from './ConfirmModal'

export const DELETE_DIALOG_TITLE = 'Eliminar amigo'
export const DELETE_CONFIRM_LABEL = 'Eliminar'
export const DELETING_LABEL = 'Eliminando…'

function deleteDialogMessage(friend) {
  const name = friend?.lastName
    ? `${friend.firstName} ${friend.lastName}`
    : friend?.firstName ?? ''
  return `¿Querés eliminar a ${name} de tus amigos?`
}

// Confirmation modal for deleting a friend (feature 016, FR-004..FR-006),
// built on ConfirmModal: the "×" (or Escape) cancels. It only renders the
// confirmation; the API calls live in FriendsList.
export default function DeleteFriendDialog({
  friend,
  isDeleting = false,
  error = null,
  onCancel,
  onConfirm,
}) {
  return (
    <ConfirmModal
      title={DELETE_DIALOG_TITLE}
      busy={isDeleting}
      error={error}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmLabel={DELETE_CONFIRM_LABEL}
      busyConfirmLabel={DELETING_LABEL}
      testId="delete-friend-dialog"
    >
      <p>{deleteDialogMessage(friend)}</p>
    </ConfirmModal>
  )
}
