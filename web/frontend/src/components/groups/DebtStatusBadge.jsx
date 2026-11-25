import { debtStatusLabel, debtStatusModifier } from '../../pages/groups/debtStatusLabels'

// State of one debt (specs/017-debt-states, FR-023). The text carries the whole
// state, so it never depends on the color alone.
export default function DebtStatusBadge({ status, outstanding }) {
  return (
    <span
      className={`group-expense__status group-expense__status--${debtStatusModifier(status)}`}
      data-testid="debt-status"
    >
      {debtStatusLabel(status, outstanding)}
    </span>
  )
}
