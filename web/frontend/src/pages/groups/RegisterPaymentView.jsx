import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { GROUP_EXPENSE_LOAD_ERROR_MESSAGE, getGroupExpense } from '../../api/groupExpensesClient'
import { PAYMENT_NETWORK_ERROR_MESSAGE, registerPayment } from '../../api/paymentsClient'
import TextField from '../../components/TextField'
import SubmitButton from '../../components/SubmitButton'
import DebtPaymentSummary from '../../components/groups/DebtPaymentSummary'
import PaymentOutcomePreview from '../../components/groups/PaymentOutcomePreview'
import { useSnackbar } from '../../components/Snackbar'
import useCurrentDate, { deviceTimeZone } from '../../hooks/useCurrentDate'
import { formatAmount } from '../../validation/expenseFormat'
import { parseArgentineAmount, parseArgentineDate } from '../../validation/expenseValidation'
import { validatePaymentAmount, validatePaymentDate } from './paymentValidation'
import './groups.scss'

// Fixed texts of the screen (specs/018-register-payment, US3; 022 T085), exported for tests.
export const PAYMENT_SUCCESS_MESSAGE = 'Pago registrado'
export const PAYMENT_REPORTED_MESSAGE =
  'Pago informado: queda esperando que un administrador lo confirme'
export const DEBT_NOT_FOUND_MESSAGE = 'No existe la deuda solicitada o no sos miembro del grupo'
export const DEBT_ALREADY_PAID_MESSAGE = 'La deuda ya está pagada'
export const DEBT_AWAITING_VALIDATION_MESSAGE =
  'Esta deuda ya tiene un pago esperando validación: esperá a que un administrador lo decida'
export const CANNOT_PAY_MESSAGE = 'No podés registrar pagos de esta deuda'
export const PAYMENT_REUSED_KEY_MESSAGE =
  'Ya se registró un pago con estos datos. Volvé al gasto para ver el estado actual'

const SERVER_FIELDS = ['amount', 'date']

// "Registrar pago" of one debt (specs/018-register-payment, US3; plan.md
// §Componentes). The debt comes from the 017 expense detail, so no new read
// endpoint is needed. The amount starts with the whole balance and the date
// with today; one Idempotency-Key per save, kept across network failures.
export default function RegisterPaymentView() {
  const { id, expenseId, debtId } = useParams()
  const auth = useAuth()
  const setUser = auth?.setUser
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const { today } = useCurrentDate()
  const expensePath = `/groups/${id}/expenses/${expenseId}`

  const [load, setLoad] = useState({ status: 'loading', debt: null, expenseDate: null, error: '' })
  const [retryToken, setRetryToken] = useState(0)
  const [idempotencyKey, setIdempotencyKey] = useState(null)
  const [formError, setFormError] = useState('')
  const [paidMeanwhile, setPaidMeanwhile] = useState(false)
  const [conflictMessage, setConflictMessage] = useState('')

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur', defaultValues: { amount: '', date: today } })
  const amountValue = useWatch({ control, name: 'amount' })

  useEffect(() => {
    let cancelled = false
    getGroupExpense(id, expenseId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        const debts = Array.isArray(result.expense?.debts) ? result.expense.debts : []
        const debt = debts.find((candidate) => String(candidate.id) === String(debtId)) ?? null
        if (!debt) {
          setLoad({ status: 'error', debt: null, expenseDate: null, error: DEBT_NOT_FOUND_MESSAGE })
          return
        }
        setLoad({ status: 'ready', debt, expenseDate: result.expense.date ?? null, error: '' })
        reset({ amount: formatAmount(debt.outstanding), date: today })
        return
      }
      if (result.status === 401) {
        setUser?.(null)
        return
      }
      setLoad({
        status: 'error',
        debt: null,
        expenseDate: null,
        error: result.network ? GROUP_EXPENSE_LOAD_ERROR_MESSAGE : DEBT_NOT_FOUND_MESSAGE,
        retryable: Boolean(result.network),
      })
    })
    return () => {
      cancelled = true
    }
  }, [id, expenseId, debtId, retryToken, setUser, reset, today])

  const { debt, expenseDate } = load
  const todayIso = parseArgentineDate(today).iso
  // 028: una ocurrencia recurrente anticipada tiene fecha futura, pero sus
  // deudas ya existen: se permite pagarla antes de esa fecha. Para gastos
  // normales se mantiene el mínimo de la fecha del gasto.
  const minimumExpenseDate = expenseDate && expenseDate <= todayIso ? expenseDate : null
  const parsedAmount = parseArgentineAmount(amountValue)

  const onSubmit = async (values) => {
    clearErrors()
    setFormError('')
    const amount = parseArgentineAmount(values.amount)
    const date = parseArgentineDate(values.date)
    const payload = {
      debtId: debt.id,
      amount: amount.ok ? amount.canonical : values.amount,
      date: date.ok ? date.iso : values.date,
      deviceTimeZone: deviceTimeZone(),
    }

    const key = idempotencyKey ?? crypto.randomUUID()
    if (idempotencyKey === null) {
      setIdempotencyKey(key)
    }
    const result = await registerPayment(payload, key)

    if (result.ok) {
      setIdempotencyKey(null)
      const message =
        result.payment?.status === 'REPORTED'
          ? PAYMENT_REPORTED_MESSAGE
          : PAYMENT_SUCCESS_MESSAGE
      showSnackbar?.(message)
      navigate(expensePath)
      return
    }
    if (result.network) {
      setFormError(PAYMENT_NETWORK_ERROR_MESSAGE)
      return
    }
    if (result.status === 401) {
      setUser?.(null)
      return
    }
    // A rejected payload is a finished operation: the next confirm gets a new key.
    setIdempotencyKey(null)
    if (result.status === 409) {
      setConflictMessage(result.detail || DEBT_ALREADY_PAID_MESSAGE)
      setPaidMeanwhile(true)
      return
    }
    if (result.status === 404) {
      setLoad({ status: 'error', debt: null, expenseDate: null, error: DEBT_NOT_FOUND_MESSAGE })
      return
    }
    if (result.status === 422) {
      setFormError(PAYMENT_REUSED_KEY_MESSAGE)
      return
    }
    const fields = result.fields ?? {}
    let shown = false
    for (const [field, message] of Object.entries(fields)) {
      if (SERVER_FIELDS.includes(field)) {
        setError(field, { type: 'server', message })
        shown = true
      }
    }
    if (!shown) {
      const general = Object.values(fields)[0]
      setFormError(result.detail || general || PAYMENT_NETWORK_ERROR_MESSAGE)
    }
  }

  const backLink = (
    <Link to={expensePath} className="group-action">
      Volver al gasto
    </Link>
  )
  const blocked =
    debt && (paidMeanwhile || debt.status === 'PAID' || debt.status === 'VERIFIED' || !debt.canRegisterPayment)
  const blockedMessage = paidMeanwhile
    ? conflictMessage || DEBT_ALREADY_PAID_MESSAGE
    : debt?.status === 'PAID' || debt?.status === 'VERIFIED'
      ? DEBT_ALREADY_PAID_MESSAGE
      : debt?.status === 'PAYMENT_REPORTED'
        ? DEBT_AWAITING_VALIDATION_MESSAGE
        : CANNOT_PAY_MESSAGE

  return (
    <main className="page group-page group-payment">
      <nav className="group-page__back">
        <Link to={expensePath}>
          <span aria-hidden="true">←</span> Volver al gasto
        </Link>
      </nav>
      <h1>Registrar pago</h1>

      {load.status === 'loading' && (
        <div role="status" className="group-expense__loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Cargando…</p>
        </div>
      )}

      {load.status === 'error' && (
        <div role="alert" data-testid="register-payment-error">
          <p>{load.error}</p>
          {load.retryable ? (
            <button
              type="button"
              onClick={() => {
                setLoad({ status: 'loading', debt: null, expenseDate: null, error: '' })
                setRetryToken((token) => token + 1)
              }}
            >
              Reintentar
            </button>
          ) : (
            backLink
          )}
        </div>
      )}

      {load.status === 'ready' && blocked && (
        <div role="alert" data-testid="register-payment-blocked">
          <p>{blockedMessage}</p>
          {backLink}
        </div>
      )}

      {load.status === 'ready' && !blocked && (
        <form className="group-card group-payment__form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <DebtPaymentSummary debt={debt} />

          {formError && (
            <p role="alert" data-testid="register-payment-form-error">
              {formError}
            </p>
          )}

          <TextField
            label="Monto"
            inputMode="decimal"
            autoComplete="off"
            error={errors.amount?.message}
            {...register('amount', {
              validate: (value) => validatePaymentAmount(value, debt.outstanding),
            })}
          />

          <TextField
            label="Fecha"
            placeholder="dd/mm/aaaa"
            autoComplete="off"
            error={errors.date?.message}
            {...register('date', {
              validate: (value) => validatePaymentDate(value, todayIso, minimumExpenseDate),
            })}
          />

          <PaymentOutcomePreview debt={debt} amount={parsedAmount.ok ? parsedAmount.canonical : null} />

          <div className="group-payment__actions">
            <SubmitButton loading={isSubmitting}>Registrar pago</SubmitButton>
            <Link to={expensePath}>Cancelar</Link>
          </div>
        </form>
      )}
    </main>
  )
}
