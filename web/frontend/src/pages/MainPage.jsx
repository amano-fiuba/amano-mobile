import MonthlyBalanceSummaryCard from '../components/main/MonthlyBalanceSummaryCard'
import PendingRequestsPanel from '../components/main/PendingRequestsPanel'
import PersonalActivity from '../components/main/PersonalActivity'
import ProfileSummary from '../components/main/ProfileSummary'
import RecentGroups from '../components/main/RecentGroups'
import MobileTabs, { MobileTab } from '../mobile/MobileTabs'
import { isMobileLayout } from '../mobile/mobileLayout'
import './MainPage.scss'

// Pantalla principal con sesión (specs/015-main-screen, US1). Cada sección carga
// sus datos de forma independiente: un error no afecta a las demás.
//
// En la app (mobile 002) el balance del mes queda arriba y el resto se reparte en
// pestañas; la tarjeta de perfil se ve desde "Más → Ver mi perfil".
export default function MainPage({ mobile = isMobileLayout() }) {
  if (mobile) {
    return (
      <main className="main-page main-page--mobile">
        <h1 className="main-page__title">Inicio</h1>
        <MonthlyBalanceSummaryCard />
        <MobileTabs name="main" label="Secciones de inicio" mobile>
          <MobileTab id="groups" label="Grupos">
            <RecentGroups />
          </MobileTab>
          <MobileTab id="activity" label="Actividad">
            <PersonalActivity />
          </MobileTab>
          <MobileTab id="requests" label="Solicitudes">
            <PendingRequestsPanel />
          </MobileTab>
        </MobileTabs>
      </main>
    )
  }

  return (
    <main className="main-page">
      <h1 className="main-page__title">Inicio</h1>
      <div className="main-page__profile-column">
        <ProfileSummary />
        <MonthlyBalanceSummaryCard />
      </div>
      <RecentGroups />
      <div className="main-page__side">
        <PersonalActivity />
        <PendingRequestsPanel />
      </div>
    </main>
  )
}
