import { formatAmount } from '../../validation/expenseFormat'

// 022 US9 / T010: show the original amount and, when the expense currency differs
// from the group currency, its converted equivalent. The backend only sends a
// converted amount when a historical quote exists; there is no client-side
// fallback rate.
export default function ConvertedAmount({
  amount,
  currency,
  convertedAmount,
  convertedCurrency,
}) {
  const original = `$ ${formatAmount(amount)} ${currency ?? ''}`.trim()
  const showConverted =
    convertedAmount != null &&
    convertedCurrency != null &&
    convertedCurrency !== currency

  return (
    <span className="converted-amount" data-testid="converted-amount">
      {original}
      {showConverted
        ? ` · $ ${formatAmount(convertedAmount)} ${convertedCurrency}`
        : null}
    </span>
  )
}
