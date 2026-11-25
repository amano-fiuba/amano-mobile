import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { getGroup, GROUPS_NETWORK_ERROR_MESSAGE } from '../../api/groupsClient'
import LeaveGroupPanel from '../../components/groups/LeaveGroupPanel'
import GroupDescriptionPanel from '../../components/groups/GroupDescriptionPanel'
import MemberListView from '../../components/groups/MemberListView'
import GroupPhotoPanel from '../../components/groups/GroupPhotoPanel'
import GroupEditForm from '../../components/groups/GroupEditForm'
import { GroupSettingsIcon, PencilIcon } from '../../components/NavIcons'
import GroupPermissionsPanel from '../../components/groups/GroupPermissionsPanel'
import GroupDebtSettingsModal from '../../components/groups/GroupDebtSettingsModal'
import GroupRowsSkeleton from '../../components/groups/GroupRowsSkeleton'
import AddMemberView from './AddMemberView'
import GroupExpensesCard from '../../components/groups/GroupExpensesCard'
import GroupFeed from '../../components/groups/GroupFeed'
import { memberCountLabel } from './groupDisplay'
import './groups.scss'
import MobileTabs, { MobileTab } from '../../mobile/MobileTabs'

function roleLabel(role) {
  return role === 'ADMIN' ? 'Administrador' : 'Miembro'
}

export default function GroupInfoView() {
  const { id } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [error, setError] = useState('')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showPermissions, setShowPermissions] = useState(false)
  const [showDebtSettings, setShowDebtSettings] = useState(false)
  const [editing, setEditing] = useState(false)
  // Bumped after an alta so MemberListView re-fetches (fix 2026-11-04).
  const [membersVersion, setMembersVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    getGroup(id).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setGroup(result.group)
      } else if (!result.network) {
        setError('No existe el grupo solicitado o no sos miembro')
      } else {
        setError(GROUPS_NETWORK_ERROR_MESSAGE)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id])

  // Re-reads the group (member count, role) after any change in the members.
  function refreshGroup() {
    getGroup(id).then((result) => {
      if (result.ok) setGroup(result.group)
    })
  }

  function handleMemberAdded() {
    setMembersVersion((version) => version + 1)
    refreshGroup()
  }

  // Editar y Configuración son excluyentes: abrir uno cierra el otro (y el
  // modal de deudas, que vive dentro de Configuración).
  function toggleEdit() {
    if (editing) {
      setEditing(false)
      return
    }
    setEditing(true)
    setShowPermissions(false)
    setShowDebtSettings(false)
  }

  function togglePermissions() {
    if (showPermissions) {
      setShowPermissions(false)
      setShowDebtSettings(false)
      return
    }
    setShowPermissions(true)
    setEditing(false)
  }

  const isAdmin = group?.currentUserRole === 'ADMIN'
  const canEditGroupData = isAdmin || Boolean(group?.permissions?.membersCanEditGroupData)

  return (
    <main className="group-detail">
      <nav className="group-page__back">
        <Link to="/groups">
          <span aria-hidden="true">←</span> Mis grupos
        </Link>
      </nav>
      {error && (
        <p role="alert" data-testid="group-error">
          {error}
        </p>
      )}
      {!group && !error && <GroupRowsSkeleton rows={2} />}
      {group && (
        <>
          <header className="group-hero" data-testid="group-detail">
            <div className="group-hero__identity">
              <GroupPhotoPanel photo={group.photo ?? null} />
              <div className="group-hero__text">
                <h1>{group.name}</h1>
                <GroupDescriptionPanel description={group.description ?? null} />
                {group.primaryCurrency && (
                  <p className="group-hero__meta" data-testid="group-currency">
                    Moneda: {group.primaryCurrency}
                  </p>
                )}
                <p className="group-hero__meta" data-testid="group-role">
                  {memberCountLabel(group.memberCount)}
                  <span aria-hidden="true">·</span>
                  <span className={`role-chip role-chip--${group.currentUserRole.toLowerCase()}`}>
                    <span className="visually-hidden">Tu rol: </span>
                    {roleLabel(group.currentUserRole)}
                  </span>
                </p>
              </div>

            </div>
            {/* Acciones arriba a la derecha y "Salir" en la esquina inferior derecha. */}
            <div className="group-hero__side">
            <div className="group-hero__actions">

                           <Link
                className="group-action"
                to={`/groups/${id}/debts`}
                data-testid="group-debts-link"
              >
                Deudas y saldos
              </Link>
              {/* Como Configuración: la cabecera no cambia, el botón pasa a
                  "Cerrar" y el formulario se abre en un panel debajo. */}
              {canEditGroupData && (
                <button
                  type="button"
                  className="group-action"
                  data-testid="group-edit-button"
                  aria-expanded={editing}
                  aria-label={editing ? 'Cerrar edición' : undefined}
                  onClick={toggleEdit}
                >
                  {editing ? 'Cerrar' : <><PencilIcon /> Editar</>}
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className="group-action"
                  aria-expanded={showPermissions}
                  aria-label={showPermissions ? 'Cerrar configuración' : undefined}
                  onClick={togglePermissions}
                >
                  {showPermissions ? 'Cerrar' : <><GroupSettingsIcon /> Configuración</>}
                </button>
              )}
            </div>
            <LeaveGroupPanel
              groupId={Number(id)}
              isLastAdmin={Boolean(group.isLastAdmin)}
              isLastMember={Boolean(group.isLastMember)}
            />
            </div>
            {editing && (
              <div className="group-admin-panel" data-testid="edit-panel">
                <GroupEditForm
                  group={group}
                  onSaved={(updated) => {
                    setGroup(updated)
                    setEditing(false)
                  }}
                />
              </div>
            )}
            {showPermissions && (
              <div className="group-admin-panel" data-testid="permissions-panel">
                <GroupPermissionsPanel
                  group={group}
                  permissions={group.permissions ?? {}}
                  onSaved={() => {
                    setShowPermissions(false)
                    setShowDebtSettings(false)
                    refreshGroup()
                  }}
                />
                <div className="group-admin-panel__subsection">
                  <button
                    type="button"
                    className="group-action"
                    data-testid="debt-settings-button"
                    aria-haspopup="dialog"
                    onClick={() => setShowDebtSettings(true)}
                  >
                    Configurar deudas y recordatorios
                  </button>
                </div>
              </div>
            )}
          </header>

          {/* Miembros, gastos y actividad a la vez, como la pantalla principal.
              En la app (mobile 002) son pestañas, con los gastos primero. */}
          <MobileTabs
            name={`group-${id}`}
            label="Secciones del grupo"
            className="group-board"
            order={['expenses', 'members', 'activity']}
          >
          <MobileTab id="members" label="Miembros" badge={group.memberCount}>
          <section className="group-detail__section" aria-labelledby="group-members-title">
            <div className="group-detail__section-header">
              <h2 id="group-members-title">Miembros ({group.memberCount})</h2>
              {isAdmin && (
                <button
                  type="button"
                  className="group-action"
                  aria-haspopup="dialog"
                  onClick={() => setShowAddMember(true)}
                >
                  Agregar miembro
                </button>
              )}
            </div>
            <MemberListView
              groupId={Number(id)}
              currentUserId={user?.id ?? null}
              isAdmin={isAdmin}
              reloadKey={membersVersion}
              onChanged={refreshGroup}
            />
          </section>
          </MobileTab>

          {/* Gastos del grupo (specs/017-debt-states, FR-021) */}
          <MobileTab id="expenses" label="Gastos">
          <GroupExpensesCard groupId={id} group={group} reloadKey={membersVersion} />
          </MobileTab>

          <MobileTab id="activity" label="Actividad">
          <section className="group-detail__section" aria-labelledby="group-activity-title">
            <div className="group-detail__section-header">
              <h2 id="group-activity-title">Actividad</h2>
              <Link to={`/groups/${id}/history`}>Ver todo</Link>
            </div>
            <GroupFeed
              groupId={id}
              size={8}
              emptyMessage="Todavía no hay actividad"
              reloadKey={membersVersion}
            />
          </section>
          </MobileTab>
          </MobileTabs>

          {showAddMember && (
            <AddMemberView
              group={group}
              permissions={group.permissions ?? {}}
              onAdded={handleMemberAdded}
              onClose={() => setShowAddMember(false)}
            />
          )}

          {showDebtSettings && (
            <GroupDebtSettingsModal
              group={group}
              isAdmin={isAdmin}
              onClose={() => setShowDebtSettings(false)}
              onSaved={() => {
                setShowDebtSettings(false)
                refreshGroup()
              }}
            />
          )}
        </>
      )}
    </main>
  )
}
