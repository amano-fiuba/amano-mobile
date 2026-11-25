import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { getGroup, getMembers, getExchangeQuote } from '../../api/groupsClient'
import { listFriends } from '../../api/friendsClient'
import { friendName } from '../../validation/friendName'
import {
  GROUP_EXPENSE_NETWORK_ERROR_MESSAGE,
  GROUP_EXPENSE_UPDATE_ERROR_MESSAGE,
  createFriendExpense,
  createGroupExpense,
  getGroupExpense,
  updateGroupExpense,
} from '../../api/groupExpensesClient'
import TextField from '../../components/TextField'
import { PaidIcon } from '../../components/NavIcons'
import SelectField from '../../components/SelectField'
import DatePickerField from '../../components/DatePickerField'
import CurrencySelect from '../../components/CurrencySelect'
import SubmitButton from '../../components/SubmitButton'
import ExpenseSummaryDialog from '../../components/ExpenseSummaryDialog'
import { REST_IN_ORDER_NOTE, REST_TO_PAYER_NOTE } from '../../components/groups/ExpenseSharePreview'
import ConvertedAmount from '../../components/debts/ConvertedAmount'
import { useSnackbar } from '../../components/Snackbar'
import useCurrentDate, { deviceTimeZone } from '../../hooks/useCurrentDate'
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  TYPE_OPTIONS,
  currencyLabel,
  labelOf,
} from '../../validation/expenseCatalog'
import {
  DATE_FUTURE,
  normalizeDescription,
  parseArgentineAmount,
  parseArgentineDate,
  preferredCurrency,
  validateDescription,
} from '../../validation/expenseValidation'
import { expensePermissions } from './expensePermissions'
import { fromCents, splitEqually, toCents } from './splitEqually'
import { convertAmount } from './convertPreview'
import { customShares, summarizeCustom } from './splitCustom'
import {
  formatPercentage,
  parsePercentage,
  percentageShares,
  summarizePercentages,
} from './splitPercentage'
import { formatAmount, formatIsoDate } from '../../validation/expenseFormat'
import { participantKey, toParticipant, userIdOf } from './participantKeys'
import './groups.scss'
import MobileTabs, { MobileTab } from '../../mobile/MobileTabs'
import { isMobileLayout } from '../../mobile/mobileLayout'

// Fixed texts of the screen (specs/017-debt-states, US3), exported for tests.
export const GROUP_EXPENSE_SUCCESS_MESSAGE = 'Gasto registrado'
export const FORM_LOAD_ERROR_MESSAGE = 'No se pudo cargar el grupo. Intentá nuevamente'
export const NOT_A_MEMBER_MESSAGE = 'No existe el grupo solicitado o no sos miembro'
export const CANNOT_CREATE_MESSAGE = 'No podés registrar gastos en este grupo'
export const PARTICIPANTS_REQUIRED_MESSAGE = 'Elegí al menos un participante además de quien pagó'
export const REUSED_KEY_MESSAGE =
  'La operación ya fue registrada con datos distintos. Reintentá el guardado.'
// 022 T070: preview of the converted amount (the final quote is fixed on save).
export const QUOTE_NOTICE = 'La cotización final se fija al guardar'
export const QUOTE_LOADING_MESSAGE = 'Calculando la cotización…'
export const QUOTE_ERROR_MESSAGE =
  'No pudimos obtener la cotización en este momento. Podés guardar el gasto igual: la cotización final se fija al guardar.'
export const QUOTE_DEBOUNCE_MS = 400
// 022 T072/T073: split method, hints of the split inputs and 403 fallback.
const SPLIT_OPTIONS = Object.freeze([
  { code: 'EQUAL', label: 'Partes iguales' },
  { code: 'CUSTOM', label: 'Personalizado' },
  { code: 'PERCENTAGE', label: 'Porcentajes' },
])
export const SPLIT_METHOD_LABEL = '¿Cómo se reparte?'
export const FILL_REMAINING_LABEL = 'Repartir lo que falta en partes iguales'
export const SPLIT_HINT_CUSTOM = 'Cargá el importe de cada participante en la moneda del gasto'
export const SPLIT_HINT_PERCENTAGE = 'Cargá el porcentaje de cada participante'
export const SPLIT_NEEDS_AMOUNT = 'Ingresá el monto del gasto para poder repartirlo'
export const PAYER_ALWAYS_PARTICIPATES = 'Quien pagó siempre participa del reparto'
export const SPLIT_ESTIMATE_NOTE = 'Montos estimados en la moneda del grupo'
export const ONLY_OWN_PAYMENTS_MESSAGE = 'Solo podés registrar gastos pagados por vos'
// 022 T077: personal expenses (create without participants) and their edition.
// The panel switch is on by default; turning it off makes the expense personal.
export const SHARED_LABEL = 'Gasto compartido'
export const PERSONAL_NOTE = 'Se registra solo a nombre de quien pagó y no genera deudas.'
export const EDIT_SUCCESS_MESSAGE = 'Gasto actualizado'
export const EDIT_NOTHING_MESSAGE = 'Enviá al menos un campo para editar'
export const EDIT_NOT_PERSONAL_MESSAGE = 'No se permite editar un gasto que ya tiene participantes'
export const EDIT_NOT_ALLOWED_MESSAGE = 'No podés editar este gasto'
export const EXPENSE_GONE_MESSAGE = 'No existe el gasto solicitado o no sos miembro del grupo'
// 027 US4: expense shared with one friend (same form, no group).
export const NOT_A_FRIEND_MESSAGE = 'No sos amigo de ese usuario'
export const FRIEND_LOAD_ERROR_MESSAGE = 'No se pudo cargar a tu amigo. Intentá nuevamente'
export const FRIEND_SUCCESS_PREFIX = 'Gasto registrado con'
// Recurring shared expenses: same frequency catalog as personal expenses.
export const FREQUENCY_REQUIRED_MESSAGE = 'La frecuencia es obligatoria'

const SERVER_FIELDS = ['amount', 'currency', 'date', 'description', 'category', 'type', 'paymentMethod', 'frequency']

// 027 (FR-020): the 007 classification, with the personal-expense messages.
const REQUIRED_SELECT_MESSAGES = {
  category: 'La categoría es obligatoria',
  type: 'El tipo de gasto es obligatorio',
  paymentMethod: 'El medio de pago es obligatorio',
}
// Required on creation; an edition of an older expense may leave them empty.
const requiredSelect = (field, isEdit) => (value) =>
  value || isEdit ? true : REQUIRED_SELECT_MESSAGES[field]

// "Nuevo gasto" of a group (specs/017-debt-states, US3; plan.md §Diseño del
// frontend): amount, currency, date, description, payer and participants, with
// the live preview of the equal split. One Idempotency-Key per save operation,
// kept across network failures (same rule as ExpenseForm of 007).
// 027 US3: calendar date, the user's currencies plus "Ver más", category, type
// and payment method, a Cancelar / Guardar footer ("Guardar" opens a final summary
// and the expense is saved after "Confirmar") and, on wide screens, a
// height set by the left column with a scrollable split panel (FR-020..FR-024).
// 027 US4: with mode="friend" (/friends/:friendId/expenses/new) the same form
// registers an expense with one friend: both are the only participants, there is
// no "Gasto compartido" switch and no conversion (FR-030..FR-034).
export default function GroupExpenseFormView({ mode = 'group' }) {
  const { id, expenseId, friendId } = useParams()
  const isFriend = mode === 'friend'
  const isEdit = !isFriend && Boolean(expenseId)
  const auth = useAuth()
  const currentUserId = auth?.user?.id ?? null
  const myName = [auth?.user?.firstName, auth?.user?.lastName].filter(Boolean).join(' ') || 'Vos'
  const myCurrencies = auth?.user?.currencies
  // Stable dependency: the session object may be recreated with an equal list.
  const myCurrenciesKey = Array.isArray(myCurrencies) ? myCurrencies.join(',') : ''
  const setUser = auth?.setUser
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const { today } = useCurrentDate()

  const [load, setLoad] = useState({ status: 'loading', group: null, members: [], error: '' })
  const [retryToken, setRetryToken] = useState(0)
  const [payerKey, setPayerKey] = useState(null)
  const [selected, setSelected] = useState([])
  const [idempotencyKey, setIdempotencyKey] = useState(null)
  const [formError, setFormError] = useState('')
  const [participantsError, setParticipantsError] = useState('')
  const [splitMethod, setSplitMethod] = useState('EQUAL')
  const [shared, setShared] = useState(true)
  const personal = !shared
  const method = personal ? 'EQUAL' : splitMethod
  // Typed values per method and participant key (kept when switching method).
  const [splitValues, setSplitValues] = useState({ CUSTOM: {}, PERCENTAGE: {} })
  const [payerError, setPayerError] = useState('')
  // App móvil (mobile 002): el alta se divide en dos pasos, datos y reparto.
  const [mobileStep, setMobileStep] = useState('details')
  // Last answer of exchange-quote, tagged with the request it belongs to.
  const [quote, setQuote] = useState({ key: null, status: 'idle', converted: null })
  // Validated payload waiting for "Confirmar" in the summary (027).
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    control,
    setValue,
    reset,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      amount: '',
      currency: 'ARS',
      date: today,
      description: '',
      category: '',
      type: '',
      paymentMethod: '',
      frequency: '',
    },
  })
  const amountValue = useWatch({ control, name: 'amount' })
  const currencyValue = useWatch({ control, name: 'currency' })
  const dateValue = useWatch({ control, name: 'date' })
  const typeValue = useWatch({ control, name: 'type' })

  // A frequency only belongs to a recurring shared expense.
  useEffect(() => {
    if (typeValue !== 'RECURRING') setValue('frequency', '')
  }, [typeValue, setValue])

  useEffect(() => {
    if (!isFriend) return undefined
    let cancelled = false
    listFriends().then((result) => {
      if (cancelled) return
      if (!result.ok) {
        if (result.status === 401) {
          setUser?.(null)
          return
        }
        const retryable = Boolean(result.network) || result.status >= 500
        setLoad({
          status: 'error',
          group: null,
          members: [],
          error: retryable ? FRIEND_LOAD_ERROR_MESSAGE : NOT_A_FRIEND_MESSAGE,
          retryable,
          notFriend: !retryable,
        })
        return
      }
      const friend = (result.friends ?? []).find((item) => String(item.id) === String(friendId))
      if (!friend) {
        setLoad({ status: 'error', group: null, members: [], error: NOT_A_FRIEND_MESSAGE, notFriend: true })
        return
      }
      const members = [
        { userId: currentUserId, simulatedProfileId: null, name: myName },
        { userId: friend.id, simulatedProfileId: null, name: friendName(friend) },
      ]
      setLoad({ status: 'ready', group: null, friend, members, error: '' })
      setValue('currency', preferredCurrency(myCurrenciesKey ? myCurrenciesKey.split(',') : []))
      setSelected(members.map(participantKey))
      setPayerKey(currentUserId != null ? `u:${currentUserId}` : null)
    })
    return () => {
      cancelled = true
    }
  }, [isFriend, friendId, retryToken, currentUserId, myName, myCurrenciesKey, setUser, setValue])

  useEffect(() => {
    if (isFriend) return undefined
    let cancelled = false
    Promise.all([
      getGroup(id),
      getMembers(id),
      isEdit ? getGroupExpense(id, expenseId) : Promise.resolve({ ok: true }),
    ]).then(([groupResult, membersResult, expenseResult]) => {
      if (cancelled) return
      const failed = [groupResult, membersResult, expenseResult].find((result) => !result.ok)
      if (failed) {
        if (failed.status === 401) {
          setUser?.(null)
          return
        }
        const retryable = Boolean(failed.network) || failed.status >= 500
        setLoad({
          status: 'error',
          group: null,
          members: [],
          error: retryable
            ? FORM_LOAD_ERROR_MESSAGE
            : failed === expenseResult ? EXPENSE_GONE_MESSAGE : NOT_A_MEMBER_MESSAGE,
          retryable,
        })
        return
      }
      const members = Array.isArray(membersResult.members) ? membersResult.members : []
      const expense = isEdit ? expenseResult.expense : null
      setLoad({ status: 'ready', group: groupResult.group, members, expense, error: '' })
      if (expense) {
        // 022 T077: edition starts from the stored values, in the form notation.
        reset({
          amount: String(expense.amount).replace('.', ','),
          currency: expense.currency,
          date: formatIsoDate(expense.date),
          description: expense.description ?? '',
          // Expenses created before 027 have no classification.
          category: expense.category ?? '',
          type: expense.type ?? '',
          paymentMethod: expense.paymentMethod ?? '',
        })
      } else {
        // 022: the expense currency starts as the group's currency.
        setValue('currency', groupResult.group?.primaryCurrency || 'ARS')
      }
      setSelected(members.map(participantKey))
      setPayerKey(currentUserId != null ? `u:${currentUserId}` : null)
    })
    return () => {
      cancelled = true
    }
  }, [id, expenseId, isEdit, isFriend, retryToken, currentUserId, setUser, setValue, reset])

  const { group, members } = load
  // 022 T077: only a personal expense (one share, no debts) can be edited, by who
  // registered it, its payer or an admin. The backend stays the authority.
  const editedExpense = isEdit ? load.expense : null
  let editBlocked = ''
  if (editedExpense) {
    const personalExpense =
      (editedExpense.shares?.length ?? 0) <= 1 && (editedExpense.debts?.length ?? 0) === 0
    const mayEdit =
      group?.currentUserRole === 'ADMIN' ||
      (currentUserId != null &&
        (editedExpense.createdBy?.userId === currentUserId || editedExpense.payer?.userId === currentUserId))
    if (!personalExpense) editBlocked = EDIT_NOT_PERSONAL_MESSAGE
    else if (!mayEdit) editBlocked = EDIT_NOT_ALLOWED_MESSAGE
  }
  // A friend expense has no group permissions: either of the two may have paid.
  const { canCreateExpenses, canExpenseForOthers } = isFriend
    ? { canCreateExpenses: true, canExpenseForOthers: true }
    : expensePermissions(group)
  // 027 (FR-011): the group currency and the user's own currencies come first.
  const preferredCurrencies = [
    ...(isFriend ? [] : [group?.primaryCurrency || 'ARS']),
    ...(Array.isArray(myCurrencies) ? myCurrencies : []),
  ]
  // The split panel shows first names only; when two members share one, both
  // keep their full name so they can be told apart.
  const firstNames = members.map((member) => member.name.trim().split(/\s+/)[0])
  const shortNames = Object.fromEntries(
    members.map((member, index) => [
      participantKey(member),
      firstNames.filter((name) => name === firstNames[index]).length > 1 ? member.name : firstNames[index],
    ]),
  )
  const registered = members.filter((member) => member.userId != null)
  const payerOptions = registered.map((member) => ({ code: participantKey(member), label: member.name }))

  // Participants keep the on-screen order: it is the order sent to the API and
  // the one the preview uses for the remaining cents.
  const nonEqual = method !== 'EQUAL'
  // A personal expense has the payer as its only participant (no debts).
  // In every shared expense the payer always takes part in the split and
  // cannot be unchecked (022 FR-003), whatever the split method.
  const orderedSelection = personal
    ? (payerKey ? [payerKey] : [])
    : members
      .map(participantKey)
      .filter((key) => selected.includes(key) || key === payerKey)
  const parsedAmount = parseArgentineAmount(amountValue)
  const hasOtherParticipant = personal || orderedSelection.some((key) => key !== payerKey)

  function toggleParticipant(key) {
    // El pagador no puede quitarse del reparto (022 FR-003).
    if (key === payerKey) return
    setParticipantsError('')
    setSelected((previous) =>
      previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key],
    )
  }

  const todayIso = parseArgentineDate(today).iso

  // 022 T070: the preview only exists when the chosen currency differs from the
  // group's and the amount and date are valid; it asks exchange-quote when one
  // of those three changes (debounced) and never blocks the submit.
  // FR-034: a friend expense keeps its own currency, so there is nothing to convert.
  const groupCurrency = isFriend ? currencyValue : group?.primaryCurrency || 'ARS'
  const quoteAmount = parsedAmount.ok ? parsedAmount.canonical : null
  const parsedDate = parseArgentineDate(dateValue)
  const quoteDate =
    parsedDate.ok && (todayIso == null || parsedDate.iso <= todayIso) ? parsedDate.iso : null
  const needsQuote =
    load.status === 'ready' && Boolean(currencyValue) && currencyValue !== groupCurrency &&
    quoteAmount !== null && quoteDate !== null
  const quoteKey = needsQuote ? `${currencyValue}|${quoteDate}|${quoteAmount}` : null

  useEffect(() => {
    if (quoteKey === null) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await getExchangeQuote(id, currencyValue, quoteDate)
      if (cancelled) return
      if (result.status === 401) {
        setUser?.(null)
        return
      }
      const converted = result.ok ? convertAmount(quoteAmount, result.quote?.rate) : null
      setQuote(
        converted === null
          ? { key: quoteKey, status: 'error', converted: null }
          : { key: quoteKey, status: 'ready', converted },
      )
    }, QUOTE_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [id, quoteKey, currencyValue, quoteDate, quoteAmount, setUser])

  // An answer for another request (stale inputs) counts as "still loading".
  const quoteStatus = !needsQuote ? 'idle' : quote.key === quoteKey ? quote.status : 'loading'

  // 022 T072: split by method. CUSTOM amounts are in the original currency and add
  // up to the original amount; PERCENTAGE adds up to 100. The estimated shares are
  // in the group currency (the converted total comes from the quote preview).
  const typed = splitValues[method] ?? {}
  const foreignCurrency = Boolean(currencyValue) && currencyValue !== groupCurrency
  const estimatedTotal = !parsedAmount.ok
    ? null
    : foreignCurrency
      ? (quoteStatus === 'ready' ? quote.converted : null)
      : parsedAmount.canonical
  const customEntries = orderedSelection.map((key) => {
    const parsed = parseArgentineAmount(typed[key] ?? '')
    return { key, amount: parsed.ok ? parsed.canonical : null }
  })
  const percentageEntries = orderedSelection.map((key) => ({ key, percentage: typed[key] ?? '' }))
  const customSummary =
    method === 'CUSTOM'
      ? summarizeCustom(parsedAmount.ok ? parsedAmount.canonical : null, customEntries)
      : null
  const percentageSummary = method === 'PERCENTAGE' ? summarizePercentages(percentageEntries) : null
  const splitSummary = customSummary ?? percentageSummary
  const splitValid = !nonEqual || Boolean(splitSummary?.ok)
  const anyTyped = orderedSelection.some((key) => String(typed[key] ?? '').trim() !== '')
  const originalTotal = parsedAmount.ok ? parsedAmount.canonical : null

  // Shares of `total` for the current method, mirroring the backend: in the
  // expense currency (total = original) and, for a foreign currency, in the
  // group currency (total = converted estimate). Null while the split is invalid.
  function sharesOf(total) {
    if (!total || !originalTotal) return null
    if (method === 'EQUAL') return splitEqually(total, orderedSelection, payerKey)
    if (method === 'CUSTOM') return customShares(total, originalTotal, customEntries, payerKey)
    return percentageShares(total, percentageEntries, payerKey)
  }
  const originalShares = sharesOf(originalTotal)
  const convertedShares = foreignCurrency ? sharesOf(estimatedTotal) : null

  // Amount of one participant over `total`: the exact share when the split is
  // valid, otherwise a live estimate from what was typed so far (floor, like
  // the backend does for non-payers) so every row reacts while typing.
  function rowAmount(key, total, exactShares) {
    if (exactShares) return exactShares.find((share) => share.key === key)?.amount ?? null
    const totalCents = toCents(total)
    if (totalCents === null) return null
    let part = null
    let whole = null
    if (method === 'PERCENTAGE') {
      const parsed = parsePercentage(typed[key])
      if (parsed.ok) [part, whole] = [parsed.hundredths, 10000]
    } else if (method === 'CUSTOM') {
      const cents = toCents(customEntries.find((entry) => entry.key === key)?.amount)
      const original = toCents(originalTotal)
      if (cents && original) [part, whole] = [cents, original]
    }
    if (part === null) return null
    return fromCents(Number((BigInt(totalCents) * BigInt(part)) / BigInt(whole)))
  }
  const unevenEqual =
    method === 'EQUAL' && Array.isArray(originalShares) &&
    new Set(originalShares.map((share) => share.cents)).size > 1
  const percentFill = Math.min(100, Math.max(0, (percentageSummary?.sumHundredths ?? 0) / 100))

  // "Repartir lo que falta": what is still missing (cents or hundredths of a
  // percent) goes in equal parts to the participants without a valid value; if
  // everyone has one, it is added on top of everyone's. Leftover units go to the
  // first ones in the list.
  const missing =
    method === 'CUSTOM' ? (parsedAmount.ok ? customSummary.differenceCents : 0)
      : method === 'PERCENTAGE' ? percentageSummary.differenceHundredths
        : 0
  const canFillRemaining = missing > 0 && orderedSelection.length > 0
  function unitsOf(key) {
    if (method === 'CUSTOM') {
      const parsed = parseArgentineAmount(typed[key] ?? '')
      const cents = parsed.ok ? toCents(parsed.canonical) : null
      return cents && cents > 0 ? cents : null
    }
    const parsed = parsePercentage(typed[key])
    return parsed.ok ? parsed.hundredths : null
  }
  function formatUnits(units) {
    if (method === 'PERCENTAGE') return formatPercentage(units)
    return `${Math.floor(units / 100)},${String(units % 100).padStart(2, '0')}`
  }
  function fillRemaining() {
    const empty = orderedSelection.filter((key) => unitsOf(key) === null)
    const targets = empty.length > 0 ? empty : orderedSelection
    const base = Math.floor(missing / targets.length)
    const rest = missing % targets.length
    const next = { ...typed }
    targets.forEach((key, index) => {
      const add = base + (index < rest ? 1 : 0)
      if (add > 0) next[key] = formatUnits((unitsOf(key) ?? 0) + add)
    })
    setParticipantsError('')
    setSplitValues((previous) => ({ ...previous, [method]: next }))
  }

  function setSplitValue(key, value) {
    setParticipantsError('')
    setSplitValues((previous) => ({
      ...previous,
      [method]: { ...previous[method], [key]: value },
    }))
  }

  function splitDifferenceText() {
    if (method === 'CUSTOM') {
      if (!parsedAmount.ok) return SPLIT_NEEDS_AMOUNT
      const diff = customSummary.differenceCents
      const money = (cents) => `$ ${formatAmount(`${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`)} ${currencyValue}`
      if (diff > 0) return `Faltan ${money(diff)}`
      if (diff < 0) return `Te pasaste por ${money(-diff)}`
      return 'Los importes suman exactamente el total'
    }
    const diff = percentageSummary.differenceHundredths
    if (diff > 0) return `Falta repartir ${formatPercentage(diff)} %`
    if (diff < 0) return `Te pasaste por ${formatPercentage(-diff)} %`
    return 'Los porcentajes suman exactamente 100 %'
  }
  const validateDate = (value) => {
    const date = parseArgentineDate(value)
    if (!date.ok) {
      return date.error
    }
    if (todayIso != null && date.iso > todayIso) {
      return DATE_FUTURE
    }
    return true
  }

  // 022 T077: PATCH of a personal expense; only the changed fields travel.
  async function submitEdit(values) {
    const expense = load.expense
    const amount = parseArgentineAmount(values.amount)
    const date = parseArgentineDate(values.date)
    const description = normalizeDescription(values.description) ?? ''
    const changes = {}
    if (amount.ok && amount.canonical !== expense.amount) changes.amount = amount.canonical
    if (values.currency !== expense.currency) changes.currency = values.currency
    if (date.ok && date.iso !== expense.date) changes.date = date.iso
    if (description !== (expense.description ?? '')) changes.description = description
    for (const field of ['category', 'type', 'paymentMethod']) {
      if (values[field] && values[field] !== (expense[field] ?? '')) changes[field] = values[field]
    }
    if (Object.keys(changes).length === 0) {
      setFormError(EDIT_NOTHING_MESSAGE)
      return
    }

    const result = await updateGroupExpense(id, expenseId, changes)
    if (result.ok) {
      showSnackbar?.(EDIT_SUCCESS_MESSAGE)
      navigate(`/groups/${id}/expenses/${expenseId}`)
      return
    }
    if (result.network) {
      setFormError(GROUP_EXPENSE_UPDATE_ERROR_MESSAGE)
      return
    }
    if (result.status === 401) {
      setUser?.(null)
      return
    }
    // 400 per field next to its input; 403, 404, 409 and 503 carry the server's voseo message.
    const fields = result.fields ?? {}
    for (const [field, message] of Object.entries(fields)) {
      if (SERVER_FIELDS.includes(field)) {
        setError(field, { type: 'server', message })
      }
    }
    const unplaced = Object.entries(fields)
      .filter(([field]) => !SERVER_FIELDS.includes(field))
      .map(([, message]) => message)
    if (unplaced.length > 0) {
      setFormError(unplaced.join(' '))
    } else if (Object.keys(fields).length === 0) {
      setFormError(result.detail || GROUP_EXPENSE_UPDATE_ERROR_MESSAGE)
    }
  }

  const onSubmit = async (values) => {
    clearErrors()
    setFormError('')
    setParticipantsError('')
    setPayerError('')
    if (isEdit) {
      await submitEdit(values)
      return
    }
    if (!hasOtherParticipant) {
      setParticipantsError(PARTICIPANTS_REQUIRED_MESSAGE)
      return
    }
    if (!splitValid) {
      setParticipantsError(splitSummary?.error || SPLIT_NEEDS_AMOUNT)
      return
    }

    const amount = parseArgentineAmount(values.amount)
    const date = parseArgentineDate(values.date)
    const description = normalizeDescription(values.description)
    const payload = {
      amount: amount.ok ? amount.canonical : values.amount,
      currency: values.currency,
      date: date.ok ? date.iso : values.date,
      deviceTimeZone: deviceTimeZone(),
      category: values.category,
      type: values.type,
      paymentMethod: values.paymentMethod,
      ...(values.type === 'RECURRING' && !isFriend ? { frequency: values.frequency } : {}),
      payerUserId: userIdOf(payerKey),
      splitMethod: method,
      participants: orderedSelection.map((key) => {
        const participant = toParticipant(key)
        if (method === 'CUSTOM') {
          participant.amount = parseArgentineAmount(typed[key]).canonical
        } else if (method === 'PERCENTAGE') {
          participant.percentage = parsePercentage(typed[key]).canonical
        }
        return participant
      }),
    }
    if (description !== null) {
      payload.description = description
    }

    const nameOf = (key) => members.find((member) => participantKey(member) === key)?.name ?? ''
    const money = (amount, currency) => `$ ${formatAmount(amount)} ${currency}`
    const rows = [
      isFriend
        ? { label: 'Con', value: friendName(load.friend) }
        : { label: 'Grupo', value: group?.name ?? '' },
      { label: 'Monto', value: money(payload.amount, payload.currency) },
      ...(foreignCurrency && quoteStatus === 'ready'
        ? [{ label: `Estimado en ${groupCurrency}`, value: money(quote.converted, groupCurrency) }]
        : []),
      { label: 'Moneda', value: currencyLabel(payload.currency) },
      { label: 'Fecha', value: values.date },
      { label: 'Categoría', value: labelOf(CATEGORY_OPTIONS, payload.category) },
      { label: 'Tipo de gasto', value: labelOf(TYPE_OPTIONS, payload.type) },
      ...(payload.frequency
        ? [{ label: 'Frecuencia', value: labelOf(FREQUENCY_OPTIONS, payload.frequency) }]
        : []),
      { label: 'Medio de pago', value: labelOf(PAYMENT_METHOD_OPTIONS, payload.paymentMethod) },
      ...(payload.description ? [{ label: 'Descripción', value: payload.description }] : []),
      { label: '¿Quién pagó?', value: nameOf(payerKey) },
      {
        label: 'Reparto',
        value: personal ? 'Gasto personal (sin deudas)' : SPLIT_OPTIONS.find((option) => option.code === method).label,
      },
    ]
    const shares = personal || !originalShares
      ? []
      : originalShares.map((share) => ({ name: nameOf(share.key), amount: money(share.amount, payload.currency) }))
    setPending({ payload, rows, shares })
  }

  const confirmSave = async () => {
    const { payload } = pending
    setSaving(true)
    try {
      await saveExpense(payload)
    } finally {
      setSaving(false)
      setPending(null)
    }
  }

  const saveExpense = async (payload) => {
    const key = idempotencyKey ?? crypto.randomUUID()
    if (idempotencyKey === null) {
      setIdempotencyKey(key)
    }
    const result = isFriend
      ? await createFriendExpense(friendId, payload, key)
      : await createGroupExpense(id, payload, key)

    if (result.ok) {
      setIdempotencyKey(null)
      if (isFriend) {
        showSnackbar?.(`${FRIEND_SUCCESS_PREFIX} ${friendName(load.friend)}`)
        navigate('/')
        return
      }
      showSnackbar?.(GROUP_EXPENSE_SUCCESS_MESSAGE)
      navigate(`/groups/${id}/expenses/${result.expense.id}`)
      return
    }
    if (result.network) {
      setFormError(GROUP_EXPENSE_NETWORK_ERROR_MESSAGE)
      return
    }
    if (result.status === 401) {
      setUser?.(null)
      return
    }
    // A rejected payload is a finished operation: the next confirm gets a new key.
    setIdempotencyKey(null)
    if (result.status === 403) {
      setFormError(result.detail || ONLY_OWN_PAYMENTS_MESSAGE)
      return
    }
    if (result.status === 404) {
      // FR-033: the friendship ended before saving.
      setFormError(result.detail || NOT_A_FRIEND_MESSAGE)
      return
    }
    if (result.status === 422) {
      setFormError(result.detail || REUSED_KEY_MESSAGE)
      return
    }
    const fields = result.fields ?? {}
    for (const [field, message] of Object.entries(fields)) {
      if (SERVER_FIELDS.includes(field)) {
        setError(field, { type: 'server', message })
      }
    }
    if (fields.participants) setParticipantsError(fields.participants)
    if (fields.payerUserId) setPayerError(fields.payerUserId)
    if (fields.splitMethod) setFormError(fields.splitMethod)
    if (Object.keys(fields).length === 0) {
      setFormError(result.detail || GROUP_EXPENSE_NETWORK_ERROR_MESSAGE)
    }
  }

  const backTo = isFriend ? '/' : isEdit ? `/groups/${id}/expenses/${expenseId}` : `/groups/${id}`

  return (
    <main className={`page group-page group-expense${isEdit ? '' : ' group-expense--wide'}`}>
      <nav className="group-page__back">
        <Link to={backTo}>{isFriend ? 'Volver al inicio' : isEdit ? 'Volver al gasto' : 'Volver al grupo'}</Link>
      </nav>
      <h1>
        {isEdit ? 'Editar gasto' : load.friend ? `Nuevo gasto con ${friendName(load.friend)}` : 'Nuevo gasto'}
      </h1>

      {load.status === 'loading' && (
        <div role="status" className="group-expense__loading">
          <span className="button-spinner" aria-hidden="true" />
          <p>Cargando…</p>
        </div>
      )}

      {load.status === 'error' && (
        <div role="alert" data-testid="group-expense-load-error">
          <p>{load.error}</p>
          {load.notFriend && <Link to="/friends">Ver mis amigos</Link>}
          {load.retryable && (
            <button
              type="button"
              onClick={() => {
                setLoad({ status: 'loading', group: null, members: [], error: '' })
                setRetryToken((token) => token + 1)
              }}
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {load.status === 'ready' && isEdit && editBlocked && (
        <p role="alert" data-testid="group-expense-edit-blocked">
          {editBlocked}
        </p>
      )}

      {load.status === 'ready' && !isEdit && !canCreateExpenses && (
        <p role="alert" data-testid="group-expense-forbidden">
          {CANNOT_CREATE_MESSAGE}
        </p>
      )}

      {load.status === 'ready' && (isEdit ? !editBlocked : canCreateExpenses) && (
        <form
          className={`group-expense__form${isEdit ? '' : ' group-expense__form--fixed'}`}
          onSubmit={handleSubmit(onSubmit, () => setMobileStep('details'))}
          noValidate
        >
          {formError && (
            <p role="alert" className="group-expense__form-error" data-testid="group-expense-error">
              {formError}
            </p>
          )}

          <MobileTabs
            label="Pasos del gasto"
            variant="steps"
            active={mobileStep}
            onChange={setMobileStep}
          >
          <MobileTab id="details" label="Datos">
          <div className="group-card group-expense__main">
            <TextField
              label="Monto"
              inputMode="decimal"
              autoComplete="off"
              error={errors.amount?.message}
              {...register('amount', {
                validate: (value) => {
                  const parsed = parseArgentineAmount(value)
                  return parsed.ok ? true : parsed.error
                },
              })}
            />
            <Controller
              name="currency"
              control={control}
              rules={{ validate: (value) => (value ? true : 'La moneda es obligatoria') }}
              render={({ field }) => (
                <CurrencySelect {...field} preferred={preferredCurrencies} error={errors.currency?.message} />
              )}
            />

            <Controller
              name="date"
              control={control}
              rules={{ validate: validateDate }}
              render={({ field }) => (
                <DatePickerField
                  {...field}
                  label="Fecha"
                  max={todayIso ?? undefined}
                  error={errors.date?.message}
                />
              )}
            />

            <div className="group-expense__quote" aria-live="polite" data-testid="quote-preview">
              {quoteStatus === 'loading' && <p>{QUOTE_LOADING_MESSAGE}</p>}
              {quoteStatus === 'ready' && (
                <>
                  <p>
                    Monto estimado:{' '}
                    <ConvertedAmount
                      amount={quoteAmount}
                      currency={currencyValue}
                      convertedAmount={quote.converted}
                      convertedCurrency={groupCurrency}
                    />
                  </p>
                  <p className="group-expense__quote-note">{QUOTE_NOTICE}</p>
                </>
              )}
              {quoteStatus === 'error' && <p>{QUOTE_ERROR_MESSAGE}</p>}
            </div>

            <SelectField
              label="Categoría"
              options={CATEGORY_OPTIONS}
              error={errors.category?.message}
              {...register('category', { validate: requiredSelect('category', isEdit) })}
            />

            <SelectField
              label="Tipo de gasto"
              options={TYPE_OPTIONS}
              error={errors.type?.message}
              {...register('type', { validate: requiredSelect('type', isEdit) })}
            />

            {!isEdit && !isFriend && typeValue === 'RECURRING' && (
              <SelectField
                label="Frecuencia"
                options={FREQUENCY_OPTIONS}
                error={errors.frequency?.message}
                {...register('frequency', {
                  validate: (value) => (value ? true : FREQUENCY_REQUIRED_MESSAGE),
                })}
              />
            )}

            <SelectField
              label="Medio de pago"
              options={PAYMENT_METHOD_OPTIONS}
              error={errors.paymentMethod?.message}
              {...register('paymentMethod', { validate: requiredSelect('paymentMethod', isEdit) })}
            />

            <TextField
              label="Descripción"
              autoComplete="off"
              error={errors.description?.message}
              {...register('description', {
                validate: (value) => validateDescription(value) || true,
              })}
            />

            {!isEdit && (
              <SelectField
                label="¿Quién pagó?"
                options={payerOptions}
                placeholder={null}
                value={payerKey ?? ''}
                disabled={!canExpenseForOthers}
                error={payerError}
                onChange={(event) => {
                  setPayerError('')
                  setPayerKey(event.target.value || null)
                }}
              />
            )}
          </div>
          </MobileTab>

          {!isEdit && (
            <MobileTab id="split" label="Reparto">
            <section className="group-card group-expense__split" aria-label="Reparto del gasto">
              {!isFriend && (
              <label className="group-expense__switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={shared}
                  onChange={(event) => {
                    setParticipantsError('')
                    setShared(event.target.checked)
                  }}
                />
                <span>{SHARED_LABEL}</span>
              </label>
              )}

              {personal ? (
                <p className="field__hint" data-testid="personal-note">{PERSONAL_NOTE}</p>
              ) : (
                <>
                  <fieldset className="group-expense__methods">
                    <legend className="visually-hidden">{SPLIT_METHOD_LABEL}</legend>
                    {SPLIT_OPTIONS.map((option) => (
                      <label
                        key={option.code}
                        className={`group-expense__method${splitMethod === option.code ? ' is-active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="splitMethod"
                          value={option.code}
                          checked={splitMethod === option.code}
                          onChange={() => {
                            setParticipantsError('')
                            setSplitMethod(option.code)
                          }}
                        />
                        {option.label}
                      </label>
                    ))}
                  </fieldset>

                  <fieldset className="group-expense__participants">
                    <legend className="visually-hidden">Participantes</legend>
                    <ul className={`group-expense__rows group-expense__rows--${method.toLowerCase()}`}>
                      {members.map((member) => {
                        const key = participantKey(member)
                        const included = orderedSelection.includes(key)
                        const lockedPayer = key === payerKey
                        const shortName = shortNames[key] ?? member.name
                        // What the short name leaves out stays for screen readers.
                        const hiddenName = [
                          member.name.slice(shortName.length).trim(),
                          member.simulatedProfileId != null ? '(perfil simulado)' : '',
                        ].filter(Boolean).join(' ')
                        const original = included && method !== 'CUSTOM'
                          ? rowAmount(key, originalTotal, originalShares)
                          : null
                        const converted = included && foreignCurrency
                          ? rowAmount(key, estimatedTotal, convertedShares)
                          : null
                        const sliderValue = (() => {
                          const parsed = parsePercentage(typed[key])
                          return parsed.ok ? parsed.hundredths / 100 : 0
                        })()
                        return (
                          <li
                            key={key}
                            className={`group-expense__row group-expense__row--${method.toLowerCase()}${included ? '' : ' is-excluded'}`}
                            data-testid="split-row"
                          >
                            <label
                              className="group-expense__participant"
                              title={lockedPayer ? `${member.name}. ${PAYER_ALWAYS_PARTICIPATES}` : member.name}
                            >
                              <input
                                type="checkbox"
                                checked={included}
                                disabled={lockedPayer || isFriend}
                                onChange={() => toggleParticipant(key)}
                              />
                              <span className="group-expense__name">
                                {shortName}
                                {hiddenName && <>{' '}<span className="visually-hidden">{hiddenName}</span></>}
                              </span>
                              {key === payerKey && (
                                <span className="group-expense__payer-tag" title="Pagó">
                                  <PaidIcon />
                                  <span className="visually-hidden"> (pagó)</span>
                                </span>
                              )}
                            </label>

                            {included && method === 'CUSTOM' && (
                              <div className="group-expense__row-control">
                
                                <input
                                  className="group-expense__split-input"
                                  aria-label={`Importe de ${member.name}`}
                                  inputMode="decimal"
                                  autoComplete="off"
                                  placeholder="0,00"
                                  value={typed[key] ?? ''}
                                  onChange={(event) => setSplitValue(key, event.target.value)}
                                />
                                <span className="group-expense__unit">{currencyValue}</span>
                              </div>
                            )}

                            {included && method === 'PERCENTAGE' && (
                              <div className="group-expense__row-control">
                                <input
                                  type="range"
                                  className="group-expense__slider"
                                  min="0"
                                  max="100"
                                  step="1"
                                  aria-label={`Deslizar porcentaje de ${member.name}`}
                                  value={sliderValue}
                                  style={{ '--fill': `${sliderValue}%` }}
                                  onChange={(event) => setSplitValue(key, event.target.value)}
                                />
                                <input
                                  className="group-expense__split-input group-expense__split-input--percent"
                                  aria-label={`Porcentaje de ${member.name}`}
                                  inputMode="decimal"
                                  autoComplete="off"
                                  placeholder="0"
                                  value={typed[key] ?? ''}
                                  onChange={(event) => setSplitValue(key, event.target.value)}
                                />
                                <span className="group-expense__unit">%</span>
                              </div>
                            )}

                            {(original || converted) && (
                              <span
                                className="group-expense__share"
                                data-testid="share-amount"
                                title={[
                                  original && `$ ${formatAmount(original)} ${currencyValue}`,
                                  converted && `≈ $ ${formatAmount(converted)} ${groupCurrency}`,
                                ].filter(Boolean).join(' · ')}
                              >
                                {original && (
                                  <span>$ {formatAmount(original)} {currencyValue}</span>
                                )}
                                {converted && (
                                  <span className="group-expense__share-converted">
                                    ≈ $ {formatAmount(converted)} {groupCurrency}
                                  </span>
                                )}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {participantsError && (
                      <p role="alert" data-testid="participants-error">
                        {participantsError}
                      </p>
                    )}
                  </fieldset>

                  {nonEqual && (
                    <div
                      className={`group-expense__difference${splitValid ? ' is-complete' : ''}`}
                      aria-live="polite"
                      data-testid="split-difference"
                    >
                      {method === 'PERCENTAGE' && (
                        <div className="group-expense__meter" aria-hidden="true">
                          <span style={{ width: `${percentFill}%` }} />
                        </div>
                      )}
                      {!anyTyped && !(method === 'CUSTOM' && !parsedAmount.ok) ? (
                        <p>{method === 'CUSTOM' ? SPLIT_HINT_CUSTOM : SPLIT_HINT_PERCENTAGE}</p>
                      ) : (
                        <>
                          <p className="group-expense__difference-main">{splitDifferenceText()}</p>
                          {splitSummary?.error && anyTyped && <p>{splitSummary.error}</p>}
                        </>
                      )}
                      {canFillRemaining && (
                        <button
                          type="button"
                          className="text-button group-expense__fill"
                          onClick={fillRemaining}
                        >
                          {FILL_REMAINING_LABEL}
                        </button>
                      )}
                    </div>
                  )}

                  {unevenEqual && (
                    <p className="group-expense__preview-note">
                      {orderedSelection.includes(payerKey) ? REST_TO_PAYER_NOTE : REST_IN_ORDER_NOTE}
                    </p>
                  )}
                  {foreignCurrency && convertedShares && (
                    <p className="group-expense__preview-note">{SPLIT_ESTIMATE_NOTE}</p>
                  )}
                </>
              )}
            </section>
            </MobileTab>
          )}
          </MobileTabs>

          <div className="group-expense__actions expense-actions">
            <button
              type="button"
              className="expense-actions__cancel"
              onClick={() => navigate(backTo)}
            >
              Cancelar
            </button>
            {isMobileLayout() && !isEdit && mobileStep === 'details' ? (
              <button
                type="button"
                className="expense-actions__next"
                onClick={async () => {
                  // Revisa los datos del paso 1 antes de pasar al reparto.
                  if (await trigger()) setMobileStep('split')
                }}
              >
                Siguiente: reparto
              </button>
            ) : (
            <SubmitButton
              loading={isSubmitting || saving}
              loadingLabel="Guardando…"
              disabled={!isEdit && (!hasOtherParticipant || !splitValid)}
            >
              {isEdit ? 'Guardar cambios' : 'Guardar'}
            </SubmitButton>
            )}
          </div>
          {pending && (
            <ExpenseSummaryDialog
              rows={pending.rows}
              shares={pending.shares}
              confirming={saving}
              onConfirm={confirmSave}
              onCancel={() => setPending(null)}
            />
          )}
        </form>
      )}
    </main>
  )
}
