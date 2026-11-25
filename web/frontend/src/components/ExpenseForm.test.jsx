import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/currencyClient', () => ({
  getCurrencyQuote: vi.fn(),
  listCurrencies: vi.fn().mockResolvedValue({
    ok: true,
    currencies: [
      { code: 'ARS', bcraName: 'PESO' },
      { code: 'BRL', bcraName: 'REAL' },
    ],
  }),
}))
vi.mock('../api/incomeClient', () => ({
  INCOME_NETWORK_ERROR_MESSAGE: 'No se pudo guardar el ingreso. Intenta nuevamente',
  createIncome: vi.fn(),
}))
vi.mock('../api/expenseClient', () => ({
  EXPENSE_NETWORK_ERROR_MESSAGE:
    'No se pudo guardar el gasto. Intenta nuevamente',
  createExpense: vi.fn(),
}))

import { createExpense } from '../api/expenseClient'
import { createIncome } from '../api/incomeClient'
import { getCurrencyQuote } from '../api/currencyClient'
import { SNACKBAR_VISIBLE_MS } from './Snackbar'
import ExpenseForm, {
  EXPENSE_DISCARD_CONFIRM,
  PERSONAL_QUOTE_ERROR,
  PERSONAL_QUOTE_LOADING,
  PERSONAL_QUOTE_NOTE,
  EXPENSE_REUSED_KEY_MESSAGE,
  FREQUENCY_REQUIRED_MESSAGE,
  EXPENSE_SESSION_EXPIRED_MESSAGE,
  EXPENSE_SUCCESS_MESSAGE,
  INCOME_DISCARD_CONFIRM,
  INCOME_FUTURE_NOTICE,
  INCOME_PAYMENT_REQUIRED,
  INCOME_QUOTE_NOTE,
  INCOME_SUCCESS_MESSAGE,
} from './ExpenseForm'
import {
  AMOUNT_DECIMALS,
  AMOUNT_FORMAT,
  AMOUNT_POSITIVE,
  AMOUNT_RANGE,
  AMOUNT_REQUIRED,
  DATE_FORMAT,
  DATE_FUTURE,
  DATE_INVALID,
  DATE_REQUIRED,
  DESCRIPTION_LENGTH,
  INCOME_DATE_TOO_FAR,
} from '../validation/expenseValidation'

const TODAY = '21/10/2026'

function renderForm(props = {}) {
  return render(<ExpenseForm today={TODAY} initialCurrency="USD" {...props} />)
}

async function completeRequired(user) {
  await user.type(screen.getByLabelText('Monto'), '1.234,56')
  await user.selectOptions(screen.getByLabelText('Categoría'), 'FOOD')
  await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'ONE_TIME')
  await user.selectOptions(screen.getByLabelText('Medio de pago'), 'CASH')
  await user.type(screen.getByLabelText('Descripción'), 'Almuerzo')
}

// The form's submit button (027: "Guardar"; it opens the final summary).
function submitButton() {
  return screen.getByRole('button', { name: /^(guardar|guardando…)$/i, hidden: false })
}

// "Guardar" and, when the summary opens (the form was valid), "Confirmar".
async function save(user) {
  await user.click(submitButton())
  const confirm = await screen
    .findByRole('button', { name: 'Confirmar' }, { timeout: 200 })
    .catch(() => null)
  if (confirm) {
    await user.click(confirm)
  }
}

beforeEach(() => {
  createExpense.mockReset()
  createIncome.mockReset()
  getCurrencyQuote.mockReset()
  getCurrencyQuote.mockResolvedValue({ ok: true, quote: { rate: 1500, rateSource: 'BCRA' } })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ExpenseForm (T029/T030)', () => {
  it('envía el payload normalizado con la clave y muestra el éxito, resetea y permanece (US1-1)', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()

    await completeRequired(user)
    await save(user)

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
    const [payload, key] = createExpense.mock.calls[0]
    expect(payload).toMatchObject({
      amount: '1234.56',
      currency: 'USD',
      date: '2026-10-21',
      category: 'FOOD',
      type: 'ONE_TIME',
      paymentMethod: 'CASH',
      description: 'Almuerzo',
    })
    expect(payload.deviceTimeZone).toEqual(expect.any(String))
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

    expect(await screen.findByRole('status')).toHaveTextContent(EXPENSE_SUCCESS_MESSAGE)
    expect(screen.getByLabelText('Monto')).toHaveValue('')
    expect(screen.getByLabelText('Descripción')).toHaveValue('')
    expect(screen.getByLabelText('Fecha')).toHaveValue(TODAY)
    expect(screen.getByLabelText('Moneda')).toHaveValue('USD')
    expect(screen.getByLabelText('Categoría')).toHaveValue('')
    expect(screen.getByLabelText('Tipo de gasto')).toHaveValue('')
    expect(screen.getByLabelText('Medio de pago')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('cierra la notificación automáticamente a los 5 s (FR-031)', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()

    await completeRequired(user)
    await user.click(submitButton())
    const confirm = await screen.findByRole('button', { name: 'Confirmar' })
    vi.useFakeTimers()
    fireEvent.click(confirm)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByRole('status')).toHaveTextContent(EXPENSE_SUCCESS_MESSAGE)

    act(() => {
      vi.advanceTimersByTime(SNACKBAR_VISIBLE_MS - 1)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('permite cerrar la notificación manualmente antes de los 5 s (FR-031)', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()

    await completeRequired(user)
    await save(user)
    await screen.findByRole('status')

    await user.click(screen.getByRole('button', { name: 'Cerrar notificación' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('deshabilita el botón con "Guardando…" mientras la operación está en curso (FR-027)', async () => {
    let resolveRequest
    const user = userEvent.setup()
    createExpense.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve
    }))
    renderForm()

    await completeRequired(user)
    await save(user)

    // The form button and the summary's "Confirmar" both wait, disabled.
    const pending = screen.getAllByRole('button', { name: 'Guardando…' })
    expect(pending).toHaveLength(2)
    pending.forEach((button) => expect(button).toBeDisabled())

    await act(async () => {
      resolveRequest({ ok: true, expense: { id: 1 } })
      await Promise.resolve()
    })

    expect(await screen.findByRole('status')).toHaveTextContent(EXPENSE_SUCCESS_MESSAGE)
  })

  it('conserva la clave ante un fallo de red y la renueva tras el éxito (FR-027)', async () => {
    const user = userEvent.setup()
    createExpense
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()

    await completeRequired(user)
    await save(user)
    await screen.findByTestId('expense-error')
    await save(user)
    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(2))

    const firstKey = createExpense.mock.calls[0][1]
    const secondKey = createExpense.mock.calls[1][1]
    expect(secondKey).toBe(firstKey)
    // Los datos se conservan ante el fallo.
    expect(screen.getByLabelText('Monto')).toHaveValue('1.234,56')

    await save(user)
    await screen.findByRole('status')
    // La operación exitosa todavía usa la clave conservada; la renovación
    // aplica a la SIGUIENTE operación, ya con el formulario reseteado.
    const successKey = createExpense.mock.calls[2][1]
    expect(successKey).toBe(firstKey)

    await completeRequired(user)
    await save(user)
    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(4))
    expect(createExpense.mock.calls[3][1]).not.toBe(firstKey)
  })

  it('ante 422 renueva la clave, conserva los datos y habilita un nuevo confirmar (T043)', async () => {
    const user = userEvent.setup()
    createExpense
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        reusedKey: true,
        detail: 'La operación ya fue registrada con datos distintos. Reintentá el guardado.',
      })
      .mockResolvedValueOnce({ ok: false, network: true })
    renderForm()

    await completeRequired(user)
    await save(user)

    expect(await screen.findByTestId('expense-error')).toHaveTextContent(
      EXPENSE_REUSED_KEY_MESSAGE,
    )
    expect(screen.getByLabelText('Monto')).toHaveValue('1.234,56')
    expect(screen.getByLabelText('Categoría')).toHaveValue('FOOD')

    await save(user)
    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(2))
    expect(createExpense.mock.calls[1][1]).not.toBe(createExpense.mock.calls[0][1])
  })

  it('un doble clic durante la operación envía una sola vez (T044)', async () => {
    let resolveRequest
    const user = userEvent.setup()
    createExpense.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve
    }))
    renderForm()
    await fillValidRequired(user)

    await user.click(submitButton())
    await user.dblClick(await screen.findByRole('button', { name: 'Confirmar' }))

    expect(createExpense).toHaveBeenCalledTimes(1)
    screen.getAllByRole('button', { name: 'Guardando…' }).forEach((button) => expect(button).toBeDisabled())
    await act(async () => {
      resolveRequest({ ok: true, expense: { id: 1 } })
      await Promise.resolve()
    })
    expect(await screen.findByRole('status')).toBeInTheDocument()
  })

  it('muestra el error de servidor junto al campo sin limpiar los datos (T029)', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { amount: 'El monto no puede tener más de dos decimales' },
    })
    renderForm()

    await completeRequired(user)
    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El monto no puede tener más de dos decimales',
    )
    expect(screen.getByLabelText('Monto')).toHaveValue('1.234,56')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Almuerzo')
  })
})


async function fillValidRequired(user) {
  await user.type(screen.getByLabelText('Monto'), '10,10')
  await user.selectOptions(screen.getByLabelText('Categoría'), 'FOOD')
  await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'ONE_TIME')
  await user.selectOptions(screen.getByLabelText('Medio de pago'), 'CASH')
}

function changeValue(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

const invalidCases = [
  {
    name: 'monto vacío',
    field: 'Monto',
    message: AMOUNT_REQUIRED,
    apply: () => changeValue('Monto', ''),
  },
  {
    name: 'monto con formato inválido',
    field: 'Monto',
    message: AMOUNT_FORMAT,
    apply: () => changeValue('Monto', 'abc'),
  },
  {
    name: 'monto negativo',
    field: 'Monto',
    message: AMOUNT_FORMAT,
    apply: () => changeValue('Monto', '-10'),
  },
  {
    name: 'monto con punto decimal',
    field: 'Monto',
    message: AMOUNT_FORMAT,
    apply: () => changeValue('Monto', '1234.56'),
  },
  {
    name: 'monto con tres decimales',
    field: 'Monto',
    message: AMOUNT_DECIMALS,
    apply: () => changeValue('Monto', '1,234'),
  },
  {
    name: 'monto cero',
    field: 'Monto',
    message: AMOUNT_POSITIVE,
    apply: () => changeValue('Monto', '0,00'),
  },
  {
    name: 'monto fuera de rango',
    field: 'Monto',
    message: AMOUNT_RANGE,
    apply: () => changeValue('Monto', '1.000.000.000,00'),
  },
  {
    name: 'moneda vacía',
    field: 'Moneda',
    message: 'La moneda es obligatoria',
    apply: () => changeValue('Moneda', ''),
  },
  {
    name: 'fecha vacía',
    field: 'Fecha',
    message: DATE_REQUIRED,
    apply: () => changeValue('Fecha', ''),
  },
  {
    name: 'fecha con formato inválido',
    field: 'Fecha',
    message: DATE_FORMAT,
    apply: () => changeValue('Fecha', '2026-10-21'),
  },
  {
    name: 'fecha inexistente',
    field: 'Fecha',
    message: DATE_INVALID,
    apply: () => changeValue('Fecha', '31/02/2026'),
  },
  {
    name: 'fecha futura',
    field: 'Fecha',
    message: DATE_FUTURE,
    apply: () => changeValue('Fecha', '22/10/2026'),
  },
  {
    name: 'categoría vacía',
    field: 'Categoría',
    message: 'La categoría es obligatoria',
    apply: () => changeValue('Categoría', ''),
  },
  {
    name: 'tipo vacío',
    field: 'Tipo de gasto',
    message: 'El tipo de gasto es obligatorio',
    apply: () => changeValue('Tipo de gasto', ''),
  },
  {
    name: 'medio de pago vacío',
    field: 'Medio de pago',
    message: 'El medio de pago es obligatorio',
    apply: () => changeValue('Medio de pago', ''),
  },
  {
    name: 'descripción de 201 caracteres',
    field: 'Descripción',
    message: DESCRIPTION_LENGTH,
    apply: () => changeValue('Descripción', 'a'.repeat(201)),
  },
]

describe('ExpenseForm validación (T034/T036)', () => {
  it.each(invalidCases)('$name bloquea el envío y asocia el error al campo', async ({
    field,
    message,
    apply,
  }) => {
    const user = userEvent.setup()
    renderForm()
    await fillValidRequired(user)
    apply()

    await save(user)

    const alert = await screen.findByText(message)
    expect(createExpense).not.toHaveBeenCalled()
    const control = screen.getByLabelText(field)
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAttribute('aria-describedby', alert.id)
    if (field === 'Moneda') {
      expect(screen.getByLabelText('Monto')).toHaveValue('10,10')
    } else {
      expect(screen.getByLabelText('Moneda')).toHaveValue('USD')
    }
    expect(document.body.textContent).not.toMatch(
      /exception|stacktrace|java\.|sql|token|cookie|password|@/i,
    )
  })

  it('revalida al corregir el campo y permite enviar', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()
    await fillValidRequired(user)
    changeValue('Categoría', '')

    await save(user)
    expect(await screen.findByText('La categoría es obligatoria')).toBeInTheDocument()
    expect(createExpense).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText('Categoría'), 'FOOD')
    await waitFor(() => {
      expect(screen.queryByText('La categoría es obligatoria')).not.toBeInTheDocument()
    })

    await save(user)
    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
  })

  it('acepta los límites válidos de monto, fecha y descripción', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()
    await fillValidRequired(user)
    changeValue('Monto', '999.999.999,99')
    changeValue('Fecha', TODAY)
    changeValue('Descripción', 'a'.repeat(200))

    await save(user)

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
    const [payload] = createExpense.mock.calls[0]
    expect(payload.amount).toBe('999999999.99')
    expect(payload.date).toBe('2026-10-21')
    expect(payload.description).toHaveLength(200)
  })

  it('los errores mostrados no exponen detalles internos (SC-006)', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { amount: 'El monto debe ser mayor a cero' },
    })
    renderForm()
    await fillValidRequired(user)
    await save(user)
    await screen.findByText('El monto debe ser mayor a cero')

    expect(document.body).not.toHaveTextContent(
      /exception|stacktrace|java\.|sql|token|cookie|password/i,
    )
  })
})

describe('ExpenseForm errores del backend (T035/T037)', () => {
  const fieldLabels = {
    amount: 'Monto',
    currency: 'Moneda',
    date: 'Fecha',
    category: 'Categoría',
    type: 'Tipo de gasto',
    paymentMethod: 'Medio de pago',
    description: 'Descripción',
  }

  it.each(Object.entries(fieldLabels))(
    'muestra el 400 de %s junto a su campo',
    async (field, label) => {
      const user = userEvent.setup()
      const message = `Error de servidor para ${field}`
      createExpense.mockResolvedValue({
        ok: false,
        status: 400,
        detail: 'La solicitud contiene campos inválidos',
        fields: { [field]: message },
      })
      renderForm()
      await fillValidRequired(user)
      await save(user)

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
    },
  )

  it('usa el detalle genérico cuando el 400 no trae campos', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: {},
    })
    renderForm()
    await fillValidRequired(user)
    await save(user)

    expect(await screen.findByTestId('expense-error')).toHaveTextContent(
      'La solicitud contiene campos inválidos',
    )
  })
})

describe('ExpenseForm resiliencia (T045/T046)', () => {
  it('ante 401 informa, conserva los datos y ofrece el login existente', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: false, status: 401, fields: {}, detail: '' })
    renderForm()
    await fillValidRequired(user)
    await save(user)

    expect(await screen.findByTestId('expense-error')).toHaveTextContent(
      EXPENSE_SESSION_EXPIRED_MESSAGE,
    )
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Monto')).toHaveValue('10,10')
    expect(screen.getByLabelText('Categoría')).toHaveValue('FOOD')
    expect(document.body.textContent).not.toMatch(
      /exception|stacktrace|java\.|sql|token|cookie|password|@/i,
    )
  })

  it('ante falla de red/5xx muestra el mensaje fijo, sin éxito y conserva los datos', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: false, network: true })
    renderForm()
    await fillValidRequired(user)
    await save(user)

    expect(await screen.findByTestId('expense-error')).toHaveTextContent(
      'No se pudo guardar el gasto. Intenta nuevamente',
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Monto')).toHaveValue('10,10')
    expect(screen.getByLabelText('Categoría')).toHaveValue('FOOD')
    expect(document.body.textContent).not.toMatch(
      /exception|stacktrace|java\.|sql|token|cookie|password|@/i,
    )
  })
})

describe('ExpenseForm accesibilidad y móvil (T047)', () => {
  it('asocia todas las etiquetas y permite recorrer el formulario con teclado', async () => {
    const user = userEvent.setup()
    renderForm()

    const order = [
      'Monto',
      'Moneda',
      'Fecha',
      'Categoría',
      'Tipo de gasto',
      'Medio de pago',
      'Descripción',
    ]
    for (const label of order) {
      await user.tab()
      expect(screen.getByLabelText(label)).toHaveFocus()
      if (label === 'Fecha') {
        // 027 (FR-010): the calendar button follows the date field.
        await user.tab()
        expect(screen.getByRole('button', { name: 'Abrir calendario' })).toHaveFocus()
      }
    }
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.tab()
    expect(submitButton()).toHaveFocus()
  })

  it('no desborda el viewport móvil y mantiene los controles accesibles', () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true })
    try {
      renderForm()
      for (const element of document.querySelectorAll('input, select, button')) {
        expect(element.getBoundingClientRect().width).toBeLessThanOrEqual(375)
        expect(element).toBeVisible()
      }
      expect(document.body.scrollWidth).toBeLessThanOrEqual(375)
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
    }
  })
})

describe('ExpenseForm frecuencia de gastos recurrentes (009, FR-001/FR-002)', () => {
  async function completeRecurring(user) {
    await user.type(screen.getByLabelText('Monto'), '250.000,00')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'HOUSING')
    await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'RECURRING')
    await user.selectOptions(screen.getByLabelText('Medio de pago'), 'TRANSFER')
  }

  it('muestra "Frecuencia" solo cuando el tipo es Recurrente', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.queryByLabelText('Frecuencia')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'RECURRING')
    const frequency = screen.getByLabelText('Frecuencia')
    expect(
      Array.from(frequency.options)
        .map((option) => option.textContent)
        .slice(1),
    ).toEqual(['Semanal', 'Mensual', 'Anual'])

    await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'ONE_TIME')
    expect(screen.queryByLabelText('Frecuencia')).not.toBeInTheDocument()
  })

  it('exige la frecuencia de un gasto recurrente y no envía nada sin ella', async () => {
    const user = userEvent.setup()
    renderForm()

    await completeRecurring(user)
    await save(user)

    expect(await screen.findByText(FREQUENCY_REQUIRED_MESSAGE)).toBeInTheDocument()
    expect(createExpense).not.toHaveBeenCalled()
  })

  it('envía la frecuencia elegida y la limpia tras el éxito', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 81 } })
    renderForm()

    await completeRecurring(user)
    await user.selectOptions(screen.getByLabelText('Frecuencia'), 'MONTHLY')
    await save(user)

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
    expect(createExpense.mock.calls[0][0]).toMatchObject({
      amount: '250000.00',
      type: 'RECURRING',
      frequency: 'MONTHLY',
    })
    expect(await screen.findByRole('status')).toHaveTextContent(EXPENSE_SUCCESS_MESSAGE)
    expect(screen.queryByLabelText('Frecuencia')).not.toBeInTheDocument()
  })

  it('no envía la frecuencia de un gasto único aunque se haya elegido antes', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 82 } })
    renderForm()

    await completeRecurring(user)
    await user.selectOptions(screen.getByLabelText('Frecuencia'), 'WEEKLY')
    await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'ONE_TIME')
    await save(user)

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
    expect(createExpense.mock.calls[0][0]).not.toHaveProperty('frequency')
    expect(createExpense.mock.calls[0][0].type).toBe('ONE_TIME')
  })

  it('muestra el error de servidor de la frecuencia junto al campo', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { frequency: 'La frecuencia no es válida' },
    })
    renderForm()

    await completeRecurring(user)
    await user.selectOptions(screen.getByLabelText('Frecuencia'), 'YEARLY')
    await save(user)

    expect(await screen.findByText('La frecuencia no es válida')).toBeInTheDocument()
    expect(screen.getByLabelText('Frecuencia')).toHaveValue('YEARLY')
  })
})


describe('ExpenseForm: correcciones del gasto personal (027, US2)', () => {
  it('va en una tarjeta celeste, sin "Gasto compartido", con Cancelar y Guardar al pie', () => {
    const { container } = renderForm()

    expect(container.querySelector('.group-card.expense-form__card')).toContainElement(
      screen.getByLabelText('Monto'),
    )
    expect(screen.queryByText(/gasto compartido/i)).not.toBeInTheDocument()
    const actions = container.querySelector('.expense-actions')
    const buttons = actions.querySelectorAll('button')
    expect(buttons[0]).toHaveTextContent('Cancelar')
    expect(buttons[1]).toHaveTextContent('Guardar')
    expect(container.querySelector('.expense-form__card')).not.toContainElement(actions)
  })

  it('"Cancelar" sin cambios sale directo', async () => {
    const onCancel = vi.fn()
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    renderForm({ onCancel })

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1)
    confirm.mockRestore()
  })

  it('"Cancelar" con datos cargados pide confirmación y solo sale si se acepta', async () => {
    const onCancel = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    renderForm({ onCancel })
    await user.type(screen.getByLabelText('Monto'), '10')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(confirm).toHaveBeenCalledWith(EXPENSE_DISCARD_CONFIRM)
    expect(onCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    confirm.mockRestore()
  })

  it('la fecha se elige con el calendario, que no permite días futuros', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Abrir calendario' }))
    expect(screen.getByRole('button', { name: '22 de octubre de 2026' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
    await user.click(screen.getByRole('button', { name: '30 de septiembre de 2026' }))

    expect(screen.getByLabelText('Fecha')).toHaveValue('30/09/2026')
  })

  it('lista las monedas del usuario y permite enviar una elegida en "Ver más"', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm({ initialCurrency: 'ARS', preferredCurrencies: ['ARS', 'USD'] })

    const select = screen.getByLabelText('Moneda')
    expect(within(select).getByRole('option', { name: 'Dólar estadounidense' })).toBeInTheDocument()
    await user.selectOptions(select, 'Ver más…')
    await user.click(await screen.findByLabelText('Real brasileño (BRL)'))
    await user.click(screen.getByRole('button', { name: 'Elegir' }))
    await completeRequired(user)
    await save(user)

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
    expect(createExpense.mock.calls[0][0].currency).toBe('BRL')
  })
})

describe('ExpenseForm: monto estimado en pesos (027, FR-035)', () => {
  it('en otra moneda muestra el monto estimado en pesos con el aviso', async () => {
    const user = userEvent.setup()
    getCurrencyQuote.mockResolvedValue({ ok: true, quote: { rate: 1545.5, rateSource: 'BCRA' } })
    renderForm()

    await user.type(screen.getByLabelText('Monto'), '100')

    expect(await screen.findByText(PERSONAL_QUOTE_NOTE)).toBeInTheDocument()
    expect(getCurrencyQuote).toHaveBeenCalledWith('USD', '2026-10-21')
    expect(screen.getByTestId('personal-quote')).toHaveTextContent('154.550,00 ARS')
  })

  it('en pesos o con un monto inválido no pide cotización', async () => {
    const user = userEvent.setup()
    renderForm({ initialCurrency: 'ARS' })

    await user.type(screen.getByLabelText('Monto'), '100')
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(getCurrencyQuote).not.toHaveBeenCalled()
    expect(screen.getByTestId('personal-quote')).toBeEmptyDOMElement()

    renderForm()
    const amounts = screen.getAllByLabelText('Monto')
    await user.type(amounts[1], 'abc')
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(getCurrencyQuote).not.toHaveBeenCalled()
  })

  it('mientras espera muestra "Calculando…" y si falla avisa sin bloquear el guardado', async () => {
    const user = userEvent.setup()
    let resolve
    getCurrencyQuote.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()

    await user.type(screen.getByLabelText('Monto'), '100')
    expect(screen.getByText(PERSONAL_QUOTE_LOADING)).toBeInTheDocument()
    resolve({ ok: false, status: 503 })
    expect(await screen.findByText(PERSONAL_QUOTE_ERROR)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Categoría'), 'FOOD')
    await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'ONE_TIME')
    await user.selectOptions(screen.getByLabelText('Medio de pago'), 'CASH')
    await save(user)
    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
    // The expense keeps its own currency: nothing of the preview is sent.
    expect(createExpense.mock.calls[0][0]).toMatchObject({ currency: 'USD', amount: '100.00' })
    expect(createExpense.mock.calls[0][0]).not.toHaveProperty('convertedAmount')
  })
})

describe('ExpenseForm: resumen final antes de guardar (027)', () => {
  it('"Guardar" muestra el resumen y no guarda hasta confirmar', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()
    await completeRequired(user)

    await user.click(submitButton())

    const dialog = await screen.findByRole('dialog', { name: 'Confirmá el gasto' })
    expect(createExpense).not.toHaveBeenCalled()
    const summary = within(dialog)
    expect(summary.getByText('Monto').nextSibling).toHaveTextContent('$ 1.234,56 USD')
    expect(summary.getByText('Moneda').nextSibling).toHaveTextContent('Dólar estadounidense')
    expect(summary.getByText('Fecha').nextSibling).toHaveTextContent(TODAY)
    expect(summary.getByText('Categoría').nextSibling).toHaveTextContent('Alimentos')
    expect(summary.getByText('Tipo de gasto').nextSibling).toHaveTextContent('Único')
    expect(summary.getByText('Medio de pago').nextSibling).toHaveTextContent('Efectivo')
    expect(summary.getByText('Descripción').nextSibling).toHaveTextContent('Almuerzo')
    expect(summary.getByRole('button', { name: 'Confirmar' })).toHaveFocus()

    await user.click(summary.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(createExpense).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Volver" o Escape cierran el resumen sin guardar y conservan lo cargado', async () => {
    const user = userEvent.setup()
    renderForm()
    await completeRequired(user)

    await user.click(submitButton())
    await user.click(await screen.findByRole('button', { name: 'Volver' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(submitButton())
    await screen.findByRole('dialog', { name: 'Confirmá el gasto' })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(createExpense).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Monto')).toHaveValue('1.234,56')
  })

  it('incluye la frecuencia de un recurrente y el estimado en pesos de otra moneda', async () => {
    const user = userEvent.setup()
    getCurrencyQuote.mockResolvedValue({ ok: true, quote: { rate: 1000 } })
    renderForm()
    await completeRequired(user)
    await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'RECURRING')
    await user.selectOptions(screen.getByLabelText('Frecuencia'), 'MONTHLY')
    await screen.findByText(PERSONAL_QUOTE_NOTE)

    await user.click(submitButton())

    const summary = within(await screen.findByRole('dialog', { name: 'Confirmá el gasto' }))
    expect(summary.getByText('Frecuencia').nextSibling).toHaveTextContent('Mensual')
    expect(summary.getByText('Estimado en pesos').nextSibling).toHaveTextContent('$ 1.234.560,00 ARS')
  })

  it('con datos inválidos no abre el resumen', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(submitButton())

    expect(await screen.findByText('La categoría es obligatoria')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// --- 033: the same form registers a personal income (kind="INCOME") ---------------------

function renderIncomeForm(props = {}) {
  return renderForm({ kind: 'INCOME', ...props })
}

async function completeIncome(user) {
  await user.type(screen.getByLabelText('Monto'), '850.000,00')
  await user.selectOptions(screen.getByLabelText('Categoría'), 'SALARY')
  await user.selectOptions(screen.getByLabelText('Medio de cobro'), 'TRANSFER')
  await user.type(screen.getByLabelText('Descripción'), 'Sueldo octubre')
}

describe('ExpenseForm modo ingreso (033, US1)', () => {
  it('ofrece las categorías y el medio de cobro de ingresos, sin tipo ni frecuencia', () => {
    renderIncomeForm()

    const categories = within(screen.getByLabelText('Categoría')).getAllByRole('option')
    expect(categories.map((option) => option.textContent)).toEqual(
      expect.arrayContaining(['Sueldo', 'Freelance', 'Venta', 'Reembolso', 'Otros']),
    )
    expect(screen.queryByRole('option', { name: 'Alimentos' })).not.toBeInTheDocument()
    const methods = within(screen.getByLabelText('Medio de cobro')).getAllByRole('option')
    expect(methods.map((option) => option.textContent)).toEqual(
      expect.arrayContaining(['Efectivo', 'Transferencia', 'Billetera virtual', 'Otro']),
    )
    expect(screen.queryByRole('option', { name: 'Tarjeta de crédito' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tipo de gasto')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Frecuencia')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Medio de pago')).not.toBeInTheDocument()
  })

  it('exige categoría y medio de cobro, y no abre el resumen con datos inválidos', async () => {
    const user = userEvent.setup()
    renderIncomeForm()

    await user.click(submitButton())

    expect(await screen.findByText('La categoría es obligatoria')).toBeInTheDocument()
    expect(screen.getByText(INCOME_PAYMENT_REQUIRED)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(createIncome).not.toHaveBeenCalled()
  })

  it('muestra el resumen "Confirmá el ingreso" y envía el payload sin tipo ni frecuencia', async () => {
    const user = userEvent.setup()
    createIncome.mockResolvedValue({ ok: true, income: { id: 1 } })
    renderIncomeForm()
    await completeIncome(user)

    await user.click(submitButton())

    const dialog = await screen.findByRole('dialog', { name: 'Confirmá el ingreso' })
    const summary = within(dialog)
    expect(summary.getByText('Categoría').nextSibling).toHaveTextContent('Sueldo')
    expect(summary.getByText('Medio de cobro').nextSibling).toHaveTextContent('Transferencia')
    expect(summary.queryByText('Tipo de gasto')).not.toBeInTheDocument()
    expect(createIncome).not.toHaveBeenCalled()
    await user.click(summary.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(createIncome).toHaveBeenCalledTimes(1))
    const [payload, key] = createIncome.mock.calls[0]
    expect(payload).toMatchObject({
      amount: '850000.00',
      currency: 'USD',
      date: '2026-10-21',
      category: 'SALARY',
      paymentMethod: 'TRANSFER',
      description: 'Sueldo octubre',
    })
    expect(payload).not.toHaveProperty('type')
    expect(payload).not.toHaveProperty('frequency')
    expect(payload.deviceTimeZone).toEqual(expect.any(String))
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(createExpense).not.toHaveBeenCalled()
  })

  it('tras guardar muestra el éxito del ingreso, reinicia el formulario y avisa con onSaved', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    createIncome.mockResolvedValue({ ok: true, income: { id: 7 } })
    renderIncomeForm({ onSaved })
    await completeIncome(user)

    await save(user)

    expect(await screen.findByRole('status')).toHaveTextContent(INCOME_SUCCESS_MESSAGE)
    expect(onSaved).toHaveBeenCalledWith({ ok: true, income: { id: 7 } })
    expect(screen.getByLabelText('Monto')).toHaveValue('')
  })

  it('el flujo de gasto no cambia: sin onSaved solo reinicia y no llama a createIncome', async () => {
    const user = userEvent.setup()
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    renderForm()
    await completeRequired(user)

    await save(user)

    expect(await screen.findByRole('status')).toHaveTextContent(EXPENSE_SUCCESS_MESSAGE)
    expect(createIncome).not.toHaveBeenCalled()
  })

  it('permite una fecha futura hasta un año y rechaza una posterior', async () => {
    const user = userEvent.setup()
    renderIncomeForm()
    await completeIncome(user)

    changeValue('Fecha', '21/10/2027')
    createIncome.mockResolvedValue({ ok: true, income: { id: 1 } })
    await save(user)
    await waitFor(() => expect(createIncome).toHaveBeenCalledTimes(1))
    expect(createIncome.mock.calls[0][0].date).toBe('2027-10-21')

    await completeIncome(user)
    changeValue('Fecha', '22/10/2027')
    await save(user)
    expect(await screen.findByText(INCOME_DATE_TOO_FAR)).toBeInTheDocument()
    expect(createIncome).toHaveBeenCalledTimes(1)
  })

  it('inicia con la fecha de hoy y usa el mismo selector de fecha que gastos', () => {
    const { unmount } = renderIncomeForm()
    expect(screen.getByLabelText('Fecha')).toHaveValue(TODAY)
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toBeInTheDocument()
    unmount()

    renderForm()
    expect(screen.getByLabelText('Fecha')).toHaveValue(TODAY)
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toBeInTheDocument()
  })

  it('con una fecha futura muestra el aviso informativo y con hoy o el pasado no', async () => {
    renderIncomeForm()
    expect(screen.queryByText(INCOME_FUTURE_NOTICE)).not.toBeInTheDocument()

    changeValue('Fecha', '22/10/2026')
    const notice = await screen.findByText(INCOME_FUTURE_NOTICE)
    expect(notice).toHaveAttribute('role', 'status')

    changeValue('Fecha', '21/10/2026')
    await waitFor(() => expect(screen.queryByText(INCOME_FUTURE_NOTICE)).not.toBeInTheDocument())
    changeValue('Fecha', '01/01/2020')
    expect(screen.queryByText(INCOME_FUTURE_NOTICE)).not.toBeInTheDocument()
  })

  it('el aviso no aparece con una fecha inválida ni pasado el límite de un año', async () => {
    renderIncomeForm()

    changeValue('Fecha', '31/02/2027')
    expect(screen.queryByText(INCOME_FUTURE_NOTICE)).not.toBeInTheDocument()
    changeValue('Fecha', '22/10/2027')
    expect(screen.queryByText(INCOME_FUTURE_NOTICE)).not.toBeInTheDocument()
    changeValue('Fecha', '21/10/2027')
    expect(await screen.findByText(INCOME_FUTURE_NOTICE)).toBeInTheDocument()
  })

  it('elegir un día futuro en el calendario muestra el aviso', async () => {
    const user = userEvent.setup()
    renderIncomeForm()

    await user.click(screen.getByRole('button', { name: 'Abrir calendario' }))
    await user.click(screen.getByRole('button', { name: '22 de octubre de 2026' }))

    expect(screen.getByLabelText('Fecha')).toHaveValue('22/10/2026')
    expect(await screen.findByText(INCOME_FUTURE_NOTICE)).toBeInTheDocument()
  })

  it('con una fecha futura no pide cotización ni muestra el estimado en pesos', async () => {
    const user = userEvent.setup()
    renderIncomeForm()

    changeValue('Fecha', '22/10/2026')
    await user.type(screen.getByLabelText('Monto'), '10,00')

    expect(await screen.findByText(INCOME_FUTURE_NOTICE)).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(getCurrencyQuote).not.toHaveBeenCalled()
    expect(screen.queryByText(INCOME_QUOTE_NOTE)).not.toBeInTheDocument()
  })

  it('el formulario de gasto nunca muestra el aviso de ingreso programado', async () => {
    renderForm()

    changeValue('Fecha', '22/10/2026')

    expect(screen.queryByText(INCOME_FUTURE_NOTICE)).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Fecha')).toHaveValue('22/10/2026')
  })

  it('el calendario de un ingreso no bloquea los días futuros', async () => {
    const user = userEvent.setup()
    renderIncomeForm()

    await user.click(screen.getByRole('button', { name: 'Abrir calendario' }))

    expect(screen.getByRole('button', { name: '22 de octubre de 2026' })).toBeEnabled()
  })

  it('en otra moneda estima en pesos con el texto del ingreso', async () => {
    const user = userEvent.setup()
    getCurrencyQuote.mockResolvedValue({ ok: true, quote: { rate: 1000 } })
    renderIncomeForm()

    await user.type(screen.getByLabelText('Monto'), '10,00')

    expect(await screen.findByText(INCOME_QUOTE_NOTE)).toBeInTheDocument()
  })

  it('muestra los errores por campo del servidor junto a cada campo', async () => {
    const user = userEvent.setup()
    createIncome.mockResolvedValue({
      ok: false,
      status: 400,
      fields: { amount: 'El monto debe ser mayor a cero', paymentMethod: 'El medio de cobro no es válido' },
    })
    renderIncomeForm()
    await completeIncome(user)

    await save(user)

    const amount = await screen.findByText('El monto debe ser mayor a cero')
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-describedby', amount.id)
    expect(screen.getByText('El medio de cobro no es válido')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto')).toHaveValue('850.000,00')
  })

  it('un fallo de red conserva la clave en el reintento y el éxito la renueva (US3)', async () => {
    const user = userEvent.setup()
    createIncome
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValue({ ok: true, income: { id: 1 } })
    renderIncomeForm()
    await completeIncome(user)

    await save(user)
    await screen.findByTestId('expense-error')
    await save(user)
    await waitFor(() => expect(createIncome).toHaveBeenCalledTimes(2))
    const firstKey = createIncome.mock.calls[0][1]
    expect(createIncome.mock.calls[1][1]).toBe(firstKey)

    await screen.findByRole('status')
    await completeIncome(user)
    await save(user)
    await waitFor(() => expect(createIncome).toHaveBeenCalledTimes(3))
    expect(createIncome.mock.calls[2][1]).not.toBe(firstKey)
  })

  it('ante 422 muestra el detalle, renueva la clave y conserva los datos', async () => {
    const user = userEvent.setup()
    createIncome
      .mockResolvedValueOnce({ ok: false, status: 422, reusedKey: true, detail: '' })
      .mockResolvedValue({ ok: true, income: { id: 1 } })
    renderIncomeForm()
    await completeIncome(user)

    await save(user)
    expect(await screen.findByTestId('expense-error')).toHaveTextContent(EXPENSE_REUSED_KEY_MESSAGE)
    await save(user)

    await waitFor(() => expect(createIncome).toHaveBeenCalledTimes(2))
    expect(createIncome.mock.calls[1][1]).not.toBe(createIncome.mock.calls[0][1])
  })

  it('una falla de red muestra el mensaje del ingreso y una sesión vencida ofrece el login', async () => {
    const user = userEvent.setup()
    createIncome
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: false, status: 401 })
    renderIncomeForm()
    await completeIncome(user)

    await save(user)
    expect(await screen.findByTestId('expense-error')).toHaveTextContent(
      'No se pudo guardar el ingreso. Intenta nuevamente',
    )
    await save(user)
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('"Cancelar" con datos pide confirmar el descarte del ingreso', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onCancel = vi.fn()
    renderIncomeForm({ onCancel })
    await user.type(screen.getByLabelText('Monto'), '5')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(confirm).toHaveBeenCalledWith(INCOME_DISCARD_CONFIRM)
    expect(onCancel).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
})
