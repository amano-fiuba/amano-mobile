import { useNavigate } from 'react-router'
import ExpenseForm from '../components/ExpenseForm'
import usePersonalFormDefaults, { PROFILE_FALLBACK_NOTICE } from '../hooks/usePersonalFormDefaults'

export { PROFILE_FALLBACK_NOTICE }

/**
 * New expense screen (T027, FR-001/FR-009/FR-011): protected route, date of the
 * device zone preloaded and the profile currency resolved with me() by
 * usePersonalFormDefaults. Any unreadable profile falls back to ARS; only a
 * network/5xx failure shows the non-blocking notice (a 401 is handled by
 * ProtectedRoute).
 */
export default function NewExpensePage() {
  const { today, currency, preferred, notice } = usePersonalFormDefaults()
  const navigate = useNavigate()

  return (
    <main className="page">
      <h1>Nuevo gasto</h1>
      {notice && (
        <p role="status" data-testid="currency-notice">
          {notice}
        </p>
      )}
      <ExpenseForm
        today={today}
        initialCurrency={currency}
        preferredCurrencies={preferred}
        onSaved={() => navigate('/activity?view=expenses', { state: { refreshBalance: Date.now() } })}
        onCancel={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}
      />
    </main>
  )
}
