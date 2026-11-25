// What the UI allows a member to do with group expenses (specs/017-debt-states,
// research.md D8, FR-007/FR-021). It only anticipates the backend decision
// (GroupPermissionChecker): the API answers 403 anyway.
//   - ADMIN: always both.
//   - MEMBER: creates unless `membersCannotMakeExpenses`; picks another payer
//     only with `membersCanGenerateExpensesForOthers`.

const NONE = Object.freeze({ canCreateExpenses: false, canExpenseForOthers: false })

export function expensePermissions(group) {
  if (!group) {
    return NONE
  }
  if (group.currentUserRole === 'ADMIN') {
    return { canCreateExpenses: true, canExpenseForOthers: true }
  }
  const permissions = group.permissions ?? {}
  const canCreateExpenses = !permissions.membersCannotMakeExpenses
  return {
    canCreateExpenses,
    canExpenseForOthers: canCreateExpenses && Boolean(permissions.membersCanGenerateExpensesForOthers),
  }
}
