import DebtStatusBadge from './DebtStatusBadge'
import { previewPayment } from '../../pages/groups/paymentPreview'

export const OUTCOME_LABEL = 'Después de este pago la deuda queda:'
export const OUTCOME_EMPTY_MESSAGE = 'Ingresá un monto válido para ver cómo queda la deuda'

// How the debt would look after the payment (specs/018-register-payment,
// FR-018), with the same labels as the expense detail (017). `amount` is the
// canonical amount of the form, or null while it is not valid.
export default function PaymentOutcomePreview({ debt, amount }) {
  const outcome = amount ? previewPayment(debt, amount) : null
  return (
    <div className="group-payment__preview" aria-live="polite" data-testid="payment-outcome">
      {outcome ? (
        <>
          <span>{OUTCOME_LABEL}</span>
          <DebtStatusBadge status={outcome.status} outstanding={outcome.outstanding} />
        </>
      ) : (
        <span>{OUTCOME_EMPTY_MESSAGE}</span>
      )}
    </div>
  )
}
