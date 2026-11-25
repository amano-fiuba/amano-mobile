import { formatAmount } from '../../validation/expenseFormat'

export const PREVIEW_EMPTY_MESSAGE = 'Completá el monto y elegí participantes para ver la división'
export const REST_TO_PAYER_NOTE = 'Quien pagó absorbe los centavos que sobran'
export const REST_IN_ORDER_NOTE = 'Los centavos que sobran se reparten en el orden de la lista'

// Preview of the equal split before saving (specs/017-debt-states, FR-022).
// `shares` is the output of splitEqually ([{ key, cents, amount }] or null);
// `names` maps each key to its visible name. `showNote={false}` hides the note
// about the leftover cents (it only applies to the equal split).
export default function ExpenseSharePreview({ shares, names, payerKey, showNote = true }) {
  if (!Array.isArray(shares) || shares.length === 0) {
    return (
      <p className="group-expense__preview-empty" data-testid="share-preview-empty">
        {PREVIEW_EMPTY_MESSAGE}
      </p>
    )
  }
  const uneven = new Set(shares.map((share) => share.cents)).size > 1
  const payerParticipates = shares.some((share) => share.key === payerKey)

  return (
    <div className="group-expense__preview" aria-label="División del gasto" role="group">
      <ul>
        {shares.map((share) => (
          <li key={share.key} data-testid="share-preview-row">
            <span>
              {names?.[share.key] ?? share.key}
              {share.key === payerKey && ' (pagó)'}
            </span>
            <span>$ {formatAmount(share.amount)}</span>
          </li>
        ))}
      </ul>
      {uneven && showNote && (
        <p className="group-expense__preview-note">
          {payerParticipates ? REST_TO_PAYER_NOTE : REST_IN_ORDER_NOTE}
        </p>
      )}
    </div>
  )
}
