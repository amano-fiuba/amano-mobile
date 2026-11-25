import { Link } from 'react-router'
import { GROUPS_NETWORK_ERROR_MESSAGE, listGroups } from '../../api/groupsClient'
import { useSessionData } from '../../hooks/useSessionData'
import {
  byLatestActivity,
  formatActivityDate,
  memberCountLabel,
} from '../../pages/groups/groupDisplay'
import ApiImage from '../ApiImage'

const VISIBLE_GROUPS = 5

// Los grupos con actividad más reciente (specs/015-main-screen, FR-007).
export default function RecentGroups() {
  const [{ status, items }] = useSessionData(listGroups, 'groups')

  return (
    <section className="main-card" aria-labelledby="main-groups-title">
      <div className="main-card__header">
        <h2 id="main-groups-title">Grupos</h2>
        <Link to="/groups">Ir a Grupos</Link>
      </div>

      {status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {status === 'error' && <p role="alert">{GROUPS_NETWORK_ERROR_MESSAGE}</p>}
      {status === 'ready' && items.length === 0 && (
        <p>Todavía no sos miembro de ningún grupo</p>
      )}
      {items.length > 0 && (
        <ul className="main-list">
          {byLatestActivity(items).slice(0, VISIBLE_GROUPS).map((group) => (
            <li key={group.id}>
              <Link to={`/groups/${group.id}`} className="main-group">
                {group.photo ? (
                  <ApiImage src={group.photo} alt="" width={40} height={40} />
                ) : (
                  <span className="main-group__mark" aria-hidden="true">
                    {group.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="main-group__body">
                  <strong>{group.name}</strong>
                  <small>
                    {memberCountLabel(group.memberCount)}
                    {' · '}Actividad: {formatActivityDate(group.lastActivityAt)}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
