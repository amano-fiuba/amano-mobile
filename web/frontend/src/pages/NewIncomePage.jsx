import { useNavigate } from 'react-router'
import ExpenseForm from '../components/ExpenseForm'
import usePersonalFormDefaults from '../hooks/usePersonalFormDefaults'

/**
 * New personal income screen (specs/033-income-management, US1): the expense form in
 * `INCOME` mode. After a successful save it goes to the personal activity with
 * `state.refreshBalance`, which makes the balance card ask for the balance again, so
 * the new net shows right away. The success snackbar is global and survives the
 * navigation.
 */
export default function NewIncomePage() {
  const { today, currency, preferred, notice } = usePersonalFormDefaults()
  const navigate = useNavigate()

  return (
    <main className="page">
      <h1>Nuevo ingreso</h1>
      {notice && (
        <p role="status" data-testid="currency-notice">
          {notice}
        </p>
      )}
      <ExpenseForm
        kind="INCOME"
        today={today}
        initialCurrency={currency}
        preferredCurrencies={preferred}
        onSaved={() => navigate('/activity?view=incomes', { state: { refreshBalance: Date.now() } })}
        onCancel={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}
      />
    </main>
  )
}
