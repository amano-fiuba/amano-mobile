import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import {
  PAYMENT_DECISION_NETWORK_ERROR_MESSAGE,
  confirmPayment,
  getPaymentsPendingValidation,
  rejectPayment,
} from '../../api/paymentsClient'
import { useSnackbar } from '../Snackbar'
import { formatAmount } from '../../validation/expenseFormat'
import { moneyText } from '../../pages/groups/debtMoney'
import useGroupResource from '../../pages/groups/useGroupResource'
import ResourceState from './ResourceState'

export const NO_PENDING_PAYMENTS_MESSAGE = 'No hay pagos por validar'
export const PAYMENT_CONFIRMED_MESSAGE = 'Pago confirmado'
export const PAYMENT_REJECTED_MESSAGE = 'Pago rechazado'

function decisionError(result) {
  if (result.network) return PAYMENT_DECISION_NETWORK_ERROR_MESSAGE
  switch (result.status) {
    case 403:
      return result.detail || 'Solo los administradores pueden decidir sobre los pagos'
    case 404:
      return result.detail || 'El pago ya no está disponible'
    case 409:
      return result.detail || 'Este pago no está pendiente de validación'
    default:
      return result.detail || PAYMENT_DECISION_NETWORK_ERROR_MESSAGE
  }
}

function since(days) {
  if (days <= 0) return 'Informado hoy'
  return days === 1 ? 'Informado hace 1 día' : `Informado hace ${days} días`
}

// "Pagos por validar" tab (admins only): reported payments waiting for a decision.
// After each decision the list (and the other tabs, through `onChanged`) reload.
export default function PendingPaymentsPanel({ groupId, refreshKey, onChanged }) {
  const showSnackbar = useSnackbar()
  const loader = useCallback(() => getPaymentsPendingValidation(groupId), [groupId])
  const resource = useGroupResource(loader, refreshKey)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  const payments = Array.isArray(resource.data) ? resource.data : []

  async function decide(payment, action) {
    setBusyId(payment.paymentId)
    setError('')
    const result = await (action === 'confirm' ? confirmPayment : rejectPayment)(groupId, payment.paymentId)
    setBusyId(null)
    if (result.ok) {
      showSnackbar?.(action === 'confirm' ? PAYMENT_CONFIRMED_MESSAGE : PAYMENT_REJECTED_MESSAGE)
      onChanged?.()
      return
    }
    setError(decisionError(result))
    // Already decided by someone else, or gone: the list is stale.
    if (result.status === 409 || result.status === 404) onChanged?.()
  }

  return (
    <>
      {error && (
        <p role="alert" className="group-debts__error" data-testid="decision-error">
          {error}
        </p>
      )}
      <ResourceState resource={resource} isEmpty={payments.length === 0} emptyMessage={NO_PENDING_PAYMENTS_MESSAGE}>
        <ul className="group-debts__list" aria-label="Pagos por validar">
          {payments.map((payment) => {
            const busy = busyId === payment.paymentId
            const label = `${payment.payerName} a ${payment.receiverName}`
            return (
              <li key={payment.paymentId} className="group-debts__debt" data-testid="pending-payment-row">
                <span className="group-debts__who">
                  {payment.payerName} informó un pago a {payment.receiverName}
                </span>
                <strong>
                  $ {formatAmount(moneyText(payment.amount))} {payment.currency}
                </strong>
                <small>{since(payment.daysPending)}</small>
                <span className="group-debts__actions">
                  <button
                    type="button"
                    className="group-action"
                    disabled={busy}
                    aria-label={`Confirmar pago de ${label}`}
                    onClick={() => decide(payment, 'confirm')}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="group-action"
                    disabled={busy}
                    aria-label={`Rechazar pago de ${label}`}
                    onClick={() => decide(payment, 'reject')}
                  >
                    Rechazar
                  </button>
                  {payment.expenseId != null && (
                    <Link className="group-action" to={`/groups/${groupId}/expenses/${payment.expenseId}`}>
                      Ver gasto
                    </Link>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </ResourceState>
    </>
  )
}
