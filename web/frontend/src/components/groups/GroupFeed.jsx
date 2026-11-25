import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getActivity } from '../../api/groupsClient'
import {
  deletedExpenseIds,
  describeActivity,
  expenseLinkId,
  formatTime,
} from '../../pages/groups/activityDescriptions'
import { formatActivityDate } from '../../pages/groups/groupDisplay'
import GroupRowsSkeleton from './GroupRowsSkeleton'

export const FEED_ERROR_MESSAGE = 'No se pudo cargar esta información'

/**
 * Últimos eventos del grupo para las tarjetas de su pantalla. `eventTypes` acota
 * el tipo de evento y cambiar `reloadKey` vuelve a consultar.
 */
export default function GroupFeed({ groupId, eventTypes, size = 5, emptyMessage, reloadKey = 0 }) {
  const [state, setState] = useState({ status: 'loading', entries: [] })
  const types = eventTypes?.join(',')

  useEffect(() => {
    let cancelled = false
    getActivity(groupId, { size, eventTypes: types ? types.split(',') : undefined }).then((result) => {
      if (cancelled) return
      setState(
        result.ok
          ? { status: 'ready', entries: Array.isArray(result.content) ? result.content : [] }
          : { status: 'error', entries: [] },
      )
    })
    return () => {
      cancelled = true
    }
  }, [groupId, types, size, reloadKey])

  if (state.status === 'loading') return <GroupRowsSkeleton rows={2} />
  if (state.status === 'error') return <p className="group-feed__note">{FEED_ERROR_MESSAGE}</p>
  if (state.entries.length === 0) return <p className="group-feed__note">{emptyMessage}</p>

  const deletedIds = deletedExpenseIds(state.entries)
  return (
    <ul className="group-feed">
      {state.entries.map((entry) => {
        const { actor, text } = describeActivity(entry)
        const expenseId = expenseLinkId(entry, deletedIds)
        return (
          <li key={entry.id}>
            <span>
              <strong>{actor}</strong> {text}
            </span>
            <small>
              {formatActivityDate(entry.createdAt)} · {formatTime(entry.createdAt)}
              {expenseId != null && (
                <>
                  {' · '}
                  <Link to={`/groups/${groupId}/expenses/${expenseId}`}>Ver gasto</Link>
                </>
              )}
            </small>
          </li>
        )
      })}
    </ul>
  )
}
