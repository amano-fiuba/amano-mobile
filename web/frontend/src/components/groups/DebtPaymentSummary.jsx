import DebtStatusBadge from './DebtStatusBadge'
import { formatAmount } from '../../validation/expenseFormat'

// Summary of the debt being paid (specs/018-register-payment, FR-018): who pays
// whom, total, already paid and outstanding, plus the current state badge.
export default function DebtPaymentSummary({ debt }) {
  return (
    <section className="group-payment__summary" aria-label="Deuda a pagar" data-testid="debt-payment-summary">
      <h2>
        {debt?.debtor?.name ?? 'Alguien'} le paga a {debt?.creditor?.name ?? 'alguien'}
      </h2>
      <dl className="group-payment__figures">
        <div>
          <dt>Total</dt>
          <dd>$ {formatAmount(debt?.amount)}</dd>
        </div>
        <div>
          <dt>Pagado</dt>
          <dd>$ {formatAmount(debt?.paidAmount)}</dd>
        </div>
        <div>
          <dt>Saldo</dt>
          <dd>$ {formatAmount(debt?.outstanding)}</dd>
        </div>
      </dl>
      <DebtStatusBadge status={debt?.status} outstanding={debt?.outstanding} />
    </section>
  )
}
