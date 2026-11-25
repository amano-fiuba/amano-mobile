import GroupExpenseFormView from './groups/GroupExpenseFormView'

// 027 US4 (FR-030..FR-034): "Nuevo gasto" with one friend, /friends/:friendId/expenses/new.
// It is the group expense form in friend mode: both people are the only participants.
export default function FriendExpenseFormView() {
  return <GroupExpenseFormView mode="friend" />
}
