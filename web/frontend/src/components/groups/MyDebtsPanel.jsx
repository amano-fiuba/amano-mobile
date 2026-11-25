import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { getPendingDebts } from '../../api/groupExpensesClient'
import { DEBT_PAYMENT_NETWORK_ERROR_MESSAGE, registerDebtPayment } from '../../api/paymentsClient'
import ConvertedAmount from '../debts/ConvertedAmount'
import { useSnackbar } from '../Snackbar'
import { isPayableDebtStatus } from '../../pages/groups/debtStatusLabels'
import { moneyText } from '../../pages/groups/debtMoney'
import { formatAmount } from '../../validation/expenseFormat'
import useGroupResource from '../../pages/groups/useGroupResource'
import DebtStatusBadge from './DebtStatusBadge'
import PaymentConfirmDialog from './PaymentConfirmDialog'
import WhistleButton from './WhistleButton'
import ResourceState from './ResourceState'

export const NO_OPEN_DEBTS_MESSAGE = 'No tenés deudas pendientes en este grupo'
export const PAYMENT_SUCCESS_MESSAGE = 'Pago registrado'
export const PAYMENT_REPORTED_MESSAGE = 'Pago informado: un administrador lo va a revisar'
export const REPORTED_NOTE = 'Esperando que un administrador confirme el pago'
export const ALREADY_REPORTED_MESSAGE =
  'Esta deuda ya tiene un pago esperando validación: esperá a que un administrador lo decida'

// Server failures of the registration, in voseo; the server's own message wins.
function paymentErrorMessage(result) {
  switch (result.status) {
    case 400:
      return result.fields?.amount || result.detail
        || 'El monto no coincide con lo que se debe ahora. Revisá la deuda actualizada'
    case 403:
      return result.detail || 'No podés registrar este pago'
    case 404:
      return result.detail || 'La deuda ya no está disponible'
    case 409:
      return result.detail || ALREADY_REPORTED_MESSAGE
    case 422:
      return result.detail || 'Ya se registró un pago con estos datos. Revisá el estado actual'
    case 503:
      return result.detail || 'El servicio no está disponible en este momento. Intentá más tarde'
    default:
      return result.detail || DEBT_PAYMENT_NETWORK_ERROR_MESSAGE
  }
}

// Failures that mean the debt is not what the screen showed: reload it.
const STALE_STATUSES = [400, 404, 409]

// "Mis deudas pendientes" tab: the caller's open debts (as debtor or creditor) with
// the original and converted amounts, their state and "Registrar pago" for the
// payable ones (partial or total payment). One Idempotency-Key per attempt: it is created
// when the confirmation opens and survives a network retry, never a rejection.
export default function MyDebtsPanel({ groupId, requiresValidation, refreshKey, onChanged, highlightDebtId }) {
  const auth = useAuth()
  const currentUserId = auth?.user?.id ?? null
  const setUser = auth?.setUser
  const showSnackbar = useSnackbar()
  const loader = useCallback(() => getPendingDebts(groupId), [groupId])
  const resource = useGroupResource(loader, refreshKey)
  const [attempt, setAttempt] = useState(null) // { debt, key, busy, error }
  const [panelError, setPanelError] = useState('')
  const [highlighted, setHighlighted] = useState(null)
  const trigger = useRef(null)
  const rowRefs = useRef({})

  const debts = Array.isArray(resource.data) ? resource.data : []

  // 035 FR-017: scroll to the debt of the notification and highlight it for 2 s.
  useEffect(() => {
    if (!highlightDebtId) return undefined
    const row = rowRefs.current[String(highlightDebtId)]
    if (!row) return undefined
    row.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    setHighlighted(String(highlightDebtId))
    const timer = setTimeout(() => setHighlighted(null), 2000)
    return () => clearTimeout(timer)
  }, [highlightDebtId, resource.data])

  function open(debt, button) {
    trigger.current = button
    setPanelError('')
    setAttempt({ debt, key: crypto.randomUUID(), busy: false, error: '' })
  }

  function close() {
    setAttempt(null)
    trigger.current?.focus?.()
  }

  async function confirm(amount) {
    const { debt, key } = attempt
    setAttempt({ debt, key, busy: true, error: '' })
    const result = await registerDebtPayment(groupId, debt.debtId, {
      amount,
      idempotencyKey: key,
    })
    if (result.ok) {
      showSnackbar?.(result.payment?.status === 'REPORTED' ? PAYMENT_REPORTED_MESSAGE : PAYMENT_SUCCESS_MESSAGE)
      setAttempt(null)
      onChanged?.()
      return
    }
    if (result.network) {
      // Same attempt: a retry reuses the key, so it cannot register twice.
      setAttempt({ debt, key, busy: false, error: DEBT_PAYMENT_NETWORK_ERROR_MESSAGE })
      return
    }
    if (result.status === 401) {
      setUser?.(null)
      return
    }
    setAttempt(null)
    setPanelError(paymentErrorMessage(result))
    if (STALE_STATUSES.includes(result.status)) onChanged?.()
  }

  function describe(debt) {
    if (currentUserId != null && debt.debtorUserId === currentUserId) {
      return `Le debés a ${debt.creditorName}`
    }
    if (currentUserId != null && debt.creditorUserId === currentUserId) {
      return `${debt.debtorName} te debe`
    }
    return `${debt.debtorName} le debe a ${debt.creditorName}`
  }

  return (
    <>
      {panelError && (
        <p role="alert" className="group-debts__error" data-testid="debts-action-error">
          {panelError}
        </p>
      )}
      <ResourceState resource={resource} isEmpty={debts.length === 0} emptyMessage={NO_OPEN_DEBTS_MESSAGE}>
        <ul className="group-debts__list" aria-label="Mis deudas pendientes">
          {debts.map((debt) => (
            <li
              key={debt.debtId}
              ref={(node) => {
                rowRefs.current[String(debt.debtId)] = node
              }}
              className={`group-debts__debt${highlighted === String(debt.debtId) ? ' is-highlighted' : ''}`}
              data-highlighted={highlighted === String(debt.debtId) ? 'true' : undefined}
              data-testid="my-debt-row"
            >
              <span className="group-debts__who">{describe(debt)}</span>
              <ConvertedAmount
                amount={moneyText(debt.amount)}
                currency={debt.currency}
                convertedAmount={moneyText(debt.convertedAmount)}
                convertedCurrency={debt.convertedCurrency}
              />
              <DebtStatusBadge status={debt.status} outstanding={moneyText(debt.outstanding)} />
              {debt.status === 'PAYMENT_REPORTED' && (
                <small data-testid="reported-note">{REPORTED_NOTE}</small>
              )}
              <span className="group-debts__actions">
                {isPayableDebtStatus(debt.status) && (
                  <button
                    type="button"
                    className="group-action"
                    aria-label={`Registrar pago: ${describe(debt)}`}
                    onClick={(event) => open(debt, event.currentTarget)}
                  >
                    Registrar pago
                  </button>
                )}
                {/* 030: only the creditor whistles, and only a debt with a balance to pay. */}
                {currentUserId != null && debt.creditorUserId === currentUserId
                  && isPayableDebtStatus(debt.status) && (
                  <WhistleButton
                    groupId={groupId}
                    debtId={debt.debtId}
                    debtorName={debt.debtorName}
                    amountText={`$ ${formatAmount(moneyText(debt.outstanding))} ${debt.currency}`}
                    simulated={debt.debtorUserId == null}
                    onStale={onChanged}
                  />
                )}
                <Link className="group-action" to={`/groups/${groupId}/expenses/${debt.expenseId}`}>
                  Ver gasto
                </Link>
              </span>
              {attempt?.debt.debtId === debt.debtId && (
                <PaymentConfirmDialog
                  who={describe(debt)}
                  outstanding={moneyText(debt.outstanding)}
                  currency={debt.currency}
                  requiresValidation={requiresValidation}
                  busy={attempt.busy}
                  error={attempt.error}
                  onConfirm={confirm}
                  onCancel={close}
                />
              )}
            </li>
          ))}
        </ul>
      </ResourceState>
    </>
  )
}
