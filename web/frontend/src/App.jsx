import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router'
import { AuthProvider, useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import SiteNav from './components/SiteNav'
import QuickActionsButton from './components/QuickActionsButton'
import { SnackbarProvider } from './components/Snackbar'
import MobileTabBar from './mobile/MobileTabBar'
import PushNotifications from './mobile/PushNotifications'
import { isMobileLayout } from './mobile/mobileLayout'

const HomePage = lazy(() => import('./pages/HomePage'))
const MobileWelcome = lazy(() => import('./mobile/MobileWelcome'))
const MainPage = lazy(() => import('./pages/MainPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ExpenseDetailPage = lazy(() => import('./pages/ExpenseDetailPage'))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const CheckEmailPage = lazy(() => import('./pages/CheckEmailPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ExpiredLinkPage = lazy(() => import('./pages/ExpiredLinkPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ProfileEditPage = lazy(() => import('./pages/ProfileEditPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const UsersSearchPage = lazy(() => import('./pages/UsersSearchPage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const NewExpensePage = lazy(() => import('./pages/NewExpensePage'))
const NewIncomePage = lazy(() => import('./pages/NewIncomePage'))
const IncomeDetailPage = lazy(() => import('./pages/IncomeDetailPage'))
const RecurringExpensesPage = lazy(() => import('./pages/RecurringExpensesPage'))
const GroupRecurringExpensesPage = lazy(() => import('./pages/groups/GroupRecurringExpensesPage'))
const GroupListView = lazy(() => import('./pages/groups/GroupListView'))
const CreateGroupView = lazy(() => import('./pages/groups/CreateGroupView'))
const GroupInfoView = lazy(() => import('./pages/groups/GroupInfoView'))
const GroupHistoryView = lazy(() => import('./pages/groups/GroupHistoryView'))
const GroupExpenseFormView = lazy(() => import('./pages/groups/GroupExpenseFormView'))
const FriendExpenseFormView = lazy(() => import('./pages/FriendExpenseFormView'))
const GroupDebtsView = lazy(() => import('./pages/groups/GroupDebtsView'))
const GroupExpenseDetailView = lazy(() => import('./pages/groups/GroupExpenseDetailView'))
const RegisterPaymentView = lazy(() => import('./pages/groups/RegisterPaymentView'))

// Rutas base del shell de la SPA (T015 + US1 + US2): '/', '/register',
// '/login' (specs/004-user-login), '/check-email' (pantalla "Revisa tu correo"),
// '/verify-email' (canje del enlace), '/verify-email/expired' (enlace vencido),
// '/forgot-password' y '/reset-password' (specs/006-password-recovery), todas
// públicas por diseño; '/profile' y sus rutas de edición y de
// cambio de contraseña (specs/005-edit-user-profile) quedan protegidas.
function GroupHistoryPage() {
  const { id } = useParams()
  return <GroupHistoryView groupId={id} />
}

// '/' es la landing sin sesión y la pantalla principal con sesión
// (specs/015-main-screen, FR-001). Mientras se verifica la sesión no se muestra
// ninguna de las dos, para evitar el destello de la landing.
function RootRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return null
  }
  if (user) {
    return <MainPage />
  }
  // En la app (mobile 002) la portada de marketing se reemplaza por una bienvenida corta.
  return isMobileLayout() ? <MobileWelcome /> : <HomePage />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="route-loading" aria-live="polite" />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email/expired" element={<ExpiredLinkPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* El dashboard se retiró; la ruta vieja redirige para no romper URLs guardadas. */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        {/* Ruta protegida del perfil (T005; FR-001, FR-008): sin sesión redirige. */}
        {/* Registro de gasto (specs/007-register-expense, FR-001/FR-002). */}
        <Route
          path="/expenses/new"
          element={
            <ProtectedRoute>
              <NewExpensePage />
            </ProtectedRoute>
          }
        />
        {/* Registro de ingreso personal (specs/033-income-management, US1). */}
        <Route
          path="/incomes/new"
          element={
            <ProtectedRoute>
              <NewIncomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/incomes/:id"
          element={
            <ProtectedRoute>
              <IncomeDetailPage />
            </ProtectedRoute>
          }
        />
        {/* Gasto con un amigo (specs/027-expense-entry-modes, US4). */}
        <Route
          path="/friends/:friendId/expenses/new"
          element={
            <ProtectedRoute>
              <FriendExpenseFormView />
            </ProtectedRoute>
          }
        />
        {/* Gastos recurrentes: pausar o finalizar (specs/009-pause-recurring-expense, FR-012). */}
        <Route
          path="/expenses/recurring"
          element={
            <ProtectedRoute>
              <RecurringExpensesPage />
            </ProtectedRoute>
          }
        />
        {/* Buscador de usuarios (specs/008-user-search, FR-001/FR-011). */}
        <Route
          path="/users/search"
          element={
            <ProtectedRoute>
              <UsersSearchPage />
            </ProtectedRoute>
          }
        />
        {/* Bandeja de notificaciones in-app (specs/035-in-app-notifications, US2). */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        {/* Amigos y solicitudes pendientes (specs/011-send-friend-request, FR-010). */}
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          }
        />
        {/* Grupos (specs/010-groups-management, US1): listado, creación y detalle. */}
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupListView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/new"
          element={
            <ProtectedRoute>
              <CreateGroupView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <ProtectedRoute>
              <GroupInfoView />
            </ProtectedRoute>
          }
        />
        {/* Grupos (specs/010-groups-management, US9): historial de actividad. */}
        <Route
          path="/groups/:id/history"
          element={
            <ProtectedRoute>
              <GroupHistoryPage />
            </ProtectedRoute>
          }
        />
        {/* Gastos de grupo y deudas (specs/017-debt-states, US3). */}
        <Route
          path="/groups/:id/debts"
          element={
            <ProtectedRoute>
              <GroupDebtsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id/recurring-expenses"
          element={
            <ProtectedRoute>
              <GroupRecurringExpensesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id/expenses/new"
          element={
            <ProtectedRoute>
              <GroupExpenseFormView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id/expenses/:expenseId/edit"
          element={
            <ProtectedRoute>
              <GroupExpenseFormView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id/expenses/:expenseId"
          element={
            <ProtectedRoute>
              <GroupExpenseDetailView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id/expenses/:expenseId/debts/:debtId/payment"
          element={
            <ProtectedRoute>
              <RegisterPaymentView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <ProtectedRoute>
              <StatisticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses/:id"
          element={
            <ProtectedRoute>
              <ExpenseDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        {/* Edición del perfil (specs/005-edit-user-profile, FR-001/FR-018). */}
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute>
              <ProfileEditPage />
            </ProtectedRoute>
          }
        />
        {/* Cambio de contraseña (US2 de 005). */}
        <Route
          path="/profile/password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SnackbarProvider>
          <SiteNav />
          <AppRoutes />
          <QuickActionsButton />
          <MobileTabBar />
          <PushNotifications />
        </SnackbarProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
