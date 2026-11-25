import { useEffect, useId, useRef, useState } from 'react'
import TextField from '../TextField'
import { formatAmount } from '../../validation/expenseFormat'
import { parseArgentineAmount } from '../../validation/expenseValidation'
import { validatePaymentAmount } from '../../pages/groups/paymentValidation'
import { fromCents, toCents } from '../../pages/groups/splitEqually'

export const VALIDATION_NOTICE =
  'Este grupo requiere validación: el pago queda esperando que un administrador lo confirme o lo rechace.'

function remainingText(outstanding, canonicalAmount) {
  const limit = toCents(outstanding)
  const payment = toCents(canonicalAmount)
  if (limit === null || payment === null || payment <= 0 || payment > limit) return null
  return formatAmount(fromCents(limit - payment))
}

// Confirmation before registering a partial or total payment of a debt (022 T075/T082).
// The amount starts at the debt's outstanding balance (amount − paidAmount) and can be
// edited within 0 < amount <= outstanding. The dialog takes the focus when it opens;
// Escape or "Cancelar" close it (the caller restores the focus).
export default function PaymentConfirmDialog({
  who, outstanding, currency, requiresValidation, busy, error, onConfirm, onCancel,
}) {
  const titleId = useId()
  const ref = useRef(null)
  const [rawAmount, setRawAmount] = useState(() => formatAmount(outstanding))
  const [fieldError, setFieldError] = useState('')

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const parsed = parseArgentineAmount(rawAmount)
  const valid = validatePaymentAmount(rawAmount, outstanding) === true
  const canonical = valid && parsed.ok ? parsed.canonical : null
  const remaining = canonical ? remainingText(outstanding, canonical) : null

  function handleChange(event) {
    const next = event.target.value
    setRawAmount(next)
    if (fieldError) {
      const check = validatePaymentAmount(next, outstanding)
      setFieldError(check === true ? '' : check)
    }
  }

  function handleBlur() {
    const check = validatePaymentAmount(rawAmount, outstanding)
    setFieldError(check === true ? '' : check)
  }

  function submit() {
    const check = validatePaymentAmount(rawAmount, outstanding)
    if (check !== true) {
      setFieldError(check)
      return
    }
    setFieldError('')
    onConfirm(parseArgentineAmount(rawAmount).canonical)
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="group-confirm"
      data-testid="payment-confirm-dialog"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel()
      }}
    >
      <h4 id={titleId}>Registrar pago</h4>
      <p>
        Saldo pendiente: <strong>$ {formatAmount(outstanding)} {currency}</strong>
        {who ? ` (${who})` : ''}.
      </p>
      <TextField
        label={`Monto (${currency})`}
        inputMode="decimal"
        autoComplete="off"
        disabled={busy}
        value={rawAmount}
        error={fieldError}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {canonical && (
        <p aria-live="polite" data-testid="payment-summary">
          Vas a registrar un pago de <strong>$ {formatAmount(canonical)} {currency}</strong>
          {' · '}
          <span data-testid="remaining-balance">
            Saldo restante: $ {remaining} {currency}
          </span>
        </p>
      )}
      {requiresValidation && <p data-testid="validation-notice">{VALIDATION_NOTICE}</p>}
      {error && (
        <p role="alert" data-testid="payment-error">
          {error}
        </p>
      )}
      <button type="button" className="group-action" disabled={busy} onClick={submit}>
        {busy ? 'Registrando…' : 'Sí, registrar pago'}
      </button>{' '}
      <button type="button" className="group-action" disabled={busy} onClick={onCancel}>
        Cancelar
      </button>
    </div>
  )
}
