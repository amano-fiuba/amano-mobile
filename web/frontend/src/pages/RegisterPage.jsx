import { useNavigate } from 'react-router'
import AuthPage from '../components/AuthPage'
import RegisterForm from '../components/RegisterForm'
import { CHECK_EMAIL_STORAGE_KEY } from './CheckEmailPage'

// Registration page (task T024, feature 003): a successful registration does NOT
// start a session and does not reach the dashboard (FR-001, replaces FR-016 of
// 001); the account stays "no verificada" until the email link is confirmed.
// The normalized address is kept in sessionStorage so the "Revisa tu correo"
// screen can show it again after a reload (FR-002).
export default function RegisterPage() {
  const navigate = useNavigate()

  const handleRegistered = (email) => {
    sessionStorage.setItem(CHECK_EMAIL_STORAGE_KEY, email)
    navigate('/check-email', { replace: true })
  }

  return (
    <AuthPage title="Crear tu cuenta">
      <RegisterForm onRegistered={handleRegistered} />
    </AuthPage>
  )
}
