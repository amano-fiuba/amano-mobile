import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { getGroup } from '../../api/groupsClient'
import { useAuth } from '../../auth/AuthContext'
import BalancesPanel from '../../components/groups/BalancesPanel'
import MyDebtsPanel from '../../components/groups/MyDebtsPanel'
import PendingPaymentsPanel from '../../components/groups/PendingPaymentsPanel'
import SettlementPanel from '../../components/groups/SettlementPanel'
import { LOADING_MESSAGE } from '../../components/groups/ResourceState'
import './groups.scss'

export const GROUP_LOAD_ERROR_MESSAGE = 'No se pudo cargar el grupo. Intentá nuevamente'
export const NOT_A_MEMBER_MESSAGE = 'No existe el grupo solicitado o no sos miembro'

const TABS = [
  { id: 'debts', label: 'Mis deudas pendientes' },
  { id: 'balances', label: 'Saldos' },
  { id: 'settlement', label: 'Propuesta de liquidación' },
]
const VALIDATION_TAB = { id: 'validation', label: 'Pagos por validar' }

// Debts and payments of a group (specs/022-group-debt-management, US1/US5/US6/US7):
// tabs for the caller's open debts (with the partial or total payment flow), the balances, the
// advisory settlement proposal and, for administrators only, the payments waiting
// for validation. On narrow screens the tabs stack as a list (CSS). Any action
// bumps `refreshKey`, so the visible panel reloads and the others reload when opened.
export default function GroupDebtsView({ groupId: groupIdProp }) {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const groupId = groupIdProp ?? params.id
  // Deep link from a debt notification (035 FR-017): highlight that row.
  const highlightDebtId = searchParams.get('debt')
  const setUser = useAuth()?.setUser
  const [load, setLoad] = useState({ status: 'loading', group: null, error: '' })
  const [retryToken, setRetryToken] = useState(0)
  const [active, setActive] = useState('debts')
  const [refreshKey, setRefreshKey] = useState(0)
  const tabRefs = useRef({})

  useEffect(() => {
    let cancelled = false
    getGroup(groupId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setLoad({ status: 'ready', group: result.group, error: '' })
        return
      }
      if (result.status === 401) {
        setUser?.(null)
        return
      }
      const retryable = Boolean(result.network) || result.status >= 500
      setLoad({
        status: 'error',
        group: null,
        error: retryable ? GROUP_LOAD_ERROR_MESSAGE : NOT_A_MEMBER_MESSAGE,
        retryable,
      })
    })
    return () => {
      cancelled = true
    }
  }, [groupId, retryToken, setUser])

  const group = load.group
  const isAdmin = group?.currentUserRole === 'ADMIN'
  const requiresValidation = Boolean(group?.permissions?.paymentsRequireValidation)
  const tabs = isAdmin ? [...TABS, VALIDATION_TAB] : TABS
  const activeTab = tabs.some((tab) => tab.id === active) ? active : tabs[0].id
  const bump = () => setRefreshKey((value) => value + 1)

  function onKeyDown(event, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    const edge = { Home: 0, End: tabs.length - 1 }[event.key]
    if (step === undefined && edge === undefined) return
    event.preventDefault()
    const next = edge ?? (index + step + tabs.length) % tabs.length
    setActive(tabs[next].id)
    tabRefs.current[tabs[next].id]?.focus()
  }

  return (
    <main className="page group-page group-debts">
      <nav className="group-page__back">
        <Link to={`/groups/${groupId}`}>Volver al grupo</Link>
      </nav>
      <h1>Deudas y saldos</h1>

      {load.status === 'loading' && (
        <div role="status" className="group-debts__state">
          <span className="button-spinner" aria-hidden="true" />
          <p>{LOADING_MESSAGE}</p>
        </div>
      )}

      {load.status === 'error' && (
        <div role="alert" className="group-debts__state" data-testid="group-debts-load-error">
          <p>{load.error}</p>
          {load.retryable && (
            <button
              type="button"
              className="group-action"
              onClick={() => {
                setLoad({ status: 'loading', group: null, error: '' })
                setRetryToken((value) => value + 1)
              }}
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {load.status === 'ready' && (
        <section className="group-debts__body">
          <div role="tablist" aria-label="Secciones de deudas" className="group-debts__tabs">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[tab.id] = node
                }}
                type="button"
                role="tab"
                id={`debts-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="debts-panel"
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="debts-panel"
            aria-labelledby={`debts-tab-${activeTab}`}
            className="group-debts__panel"
            data-testid="group-debts-panel"
          >
            {activeTab === 'debts' && (
              <MyDebtsPanel
                groupId={groupId}
                requiresValidation={requiresValidation}
                refreshKey={refreshKey}
                onChanged={bump}
                highlightDebtId={highlightDebtId}
              />
            )}
            {activeTab === 'balances' && <BalancesPanel groupId={groupId} refreshKey={refreshKey} />}
            {activeTab === 'settlement' && <SettlementPanel groupId={groupId} refreshKey={refreshKey} />}
            {activeTab === 'validation' && isAdmin && (
              <PendingPaymentsPanel groupId={groupId} refreshKey={refreshKey} onChanged={bump} />
            )}
          </div>
        </section>
      )}
    </main>
  )
}
