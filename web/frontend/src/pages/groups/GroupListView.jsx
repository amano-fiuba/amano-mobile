import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { listGroups, GROUPS_NETWORK_ERROR_MESSAGE } from '../../api/groupsClient'
import {
  GROUP_SORT_OPTIONS,
  formatActivityDate,
  memberCountLabel,
  sortGroups,
} from './groupDisplay'
import GroupRowsSkeleton from '../../components/groups/GroupRowsSkeleton'
import ListSearch from '../../components/ListSearch'
import { normalizeSearch } from '../../utils/personSearch'
import './groups.scss'
import HomeLink from '../../components/HomeLink'
import ApiImage from '../../components/ApiImage'

function groupCountLabel(count) {
  return count === 1 ? '1 grupo' : `${count} grupos`
}

export const NO_GROUP_MATCHES_MESSAGE = 'Ningún grupo coincide con tu búsqueda'

function filterGroups(groups, query) {
  const term = normalizeSearch(query.trim())
  if (!term) return groups
  return groups.filter((group) => normalizeSearch(group.name).includes(term))
}

function roleLabel(role) {
  return role === 'ADMIN' ? 'Administrador' : 'Miembro'
}

export default function GroupListView() {
  const [groups, setGroups] = useState(null)
  const [error, setError] = useState('')
  // `?q=` llega desde "Ver más" del buscador de la barra.
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [order, setOrder] = useState('recent')

  useEffect(() => {
    let cancelled = false
    listGroups().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setGroups(result.groups)
      } else {
        setError(GROUPS_NETWORK_ERROR_MESSAGE)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const isEmpty = groups?.length === 0
  const visibleGroups = groups ? sortGroups(filterGroups(groups, search), order) : []

  return (
    <main className="page groups-page">
      <header className="groups-page__header">
        <div>
          <HomeLink />
          <h1>Mis grupos</h1>
          {groups?.length > 0 && (
            <p className="groups-page__count" data-testid="groups-count">
              {groupCountLabel(groups.length)}
            </p>
          )}
        </div>
        {!isEmpty && (
          <Link className="buttonLink" to="/groups/new">
            Crear nuevo grupo
          </Link>
        )}
      </header>
      {error && (
        <p role="alert" data-testid="groups-error">
          {error}
        </p>
      )}
      {groups === null && !error && <GroupRowsSkeleton />}
      {isEmpty && (
        <div className="groups-page__empty" data-testid="groups-empty">
          <p>Todavía no sos miembro de ningún grupo</p>
          <Link className="buttonLink" to="/groups/new">
            Crear mi primer grupo
          </Link>
        </div>
      )}
      {groups?.length > 0 && (
        <ListSearch
          label="Buscar en Mis grupos"
          placeholder="Buscá por nombre"
          value={search}
          onChange={setSearch}
        >
          <select
            className="list-search__sort"
            aria-label="Ordenar Mis grupos"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          >
            {GROUP_SORT_OPTIONS.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </ListSearch>
      )}
      {groups?.length > 0 && visibleGroups.length === 0 && (
        <p className="groups-page__no-matches" role="status">
          {NO_GROUP_MATCHES_MESSAGE}
        </p>
      )}
      {visibleGroups.length > 0 && (
        <ul className="group-rows" data-testid="groups-list">
          {visibleGroups.map((group) => (
            <li key={group.id}>
              <Link className="group-row" to={`/groups/${group.id}`}>
                {group.photo ? (
                  <ApiImage className="group-row__mark" src={group.photo} alt="" width={48} height={48} />
                ) : (
                  <span
                    className="group-row__mark"
                    data-testid="group-avatar-default"
                    aria-hidden="true"
                  >
                    {group.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="group-row__body">
                  <span className="group-row__title">
                    <strong>{group.name}</strong>
                    <span
                      className={`role-chip role-chip--${group.currentUserRole.toLowerCase()}`}
                      data-testid={`group-role-${group.id}`}
                    >
                      {roleLabel(group.currentUserRole)}
                    </span>
                  </span>
                  {group.description && (
                    <span className="group-row__description">{group.description}</span>
                  )}
                  <small>
                    {memberCountLabel(group.memberCount)}
                    {' · '}Actividad: {formatActivityDate(group.lastActivityAt)}
                  </small>
                </span>
                <span className="group-row__chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
