import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { listGroups } from '../api/groupsClient'
import { searchUsers } from '../api/usersClient'
import { useDismiss } from '../hooks/useDismiss'
import { SearchIcon } from './NavIcons'
import ApiImage from './ApiImage'

export const PEOPLE_ERROR_MESSAGE = 'No se pudo buscar personas'
export const NO_RESULTS_MESSAGE = 'Sin resultados'

const MIN_LENGTH = 2
const DEBOUNCE_MS = 300
// Hasta 3 por sección; si hay más, "Ver más" lleva a la pantalla completa.
const MAX_RESULTS = 3
const DEFAULT_AVATAR = '/avatar-default.png'

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function fullName(person) {
  return person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName
}

// Buscador de la barra superior (specs/015-main-screen, US3): personas con el
// endpoint de 008 y grupos propios filtrados en el cliente.
export default function GlobalSearch() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [groups, setGroups] = useState([])
  const [peopleSearch, setPeopleSearch] = useState(null)
  const containerRef = useRef(null)

  const close = useCallback(() => setIsOpen(false), [])
  useDismiss(containerRef, isOpen, close)

  const trimmed = term.trim()
  const isSearchable = trimmed.length >= MIN_LENGTH

  useEffect(() => {
    if (!isSearchable) {
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await searchUsers(trimmed)
      if (!cancelled) {
        setPeopleSearch({ term: trimmed, ok: result.ok, users: result.users ?? [] })
      }
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, isSearchable])

  const allMatchingGroups = useMemo(() => {
    const needle = normalize(trimmed)
    return groups.filter((group) => normalize(group.name).includes(needle))
  }, [groups, trimmed])
  const matchingGroups = allMatchingGroups.slice(0, MAX_RESULTS)

  const handleFocus = async () => {
    setIsOpen(true)
    const result = await listGroups()
    if (result.ok) {
      setGroups(result.groups)
    }
  }

  const reset = () => {
    setIsOpen(false)
    setTerm('')
  }

  const peopleUrl = `/users/search?q=${encodeURIComponent(trimmed)}`
  const groupsUrl = `/groups?q=${encodeURIComponent(trimmed)}`

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isSearchable) {
      navigate(peopleUrl)
      reset()
    }
  }

  // Only the answer of the current term counts; anything else is still loading.
  const current = peopleSearch?.term === trimmed ? peopleSearch : null
  const allPeople = current?.users ?? []
  const people = allPeople.slice(0, MAX_RESULTS)
  const isEmpty = current?.ok && people.length === 0 && matchingGroups.length === 0

  return (
    <div className="global-search" ref={containerRef}>
      <form role="search" onSubmit={handleSubmit}>
        <SearchIcon />
        <input
          type="search"
          aria-label="Buscar personas y grupos"
          placeholder="Buscar personas y grupos"
          autoComplete="off"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value)
            setIsOpen(true)
          }}
          onFocus={handleFocus}
        />
      </form>

      {isOpen && isSearchable && (
        <div className="app-menu__panel global-search__results" role="region" aria-label="Resultados de la búsqueda">
          {!current && <p role="status">Buscando…</p>}
          {current && !current.ok && <p role="alert">{PEOPLE_ERROR_MESSAGE}</p>}
          {isEmpty && <p role="status">{NO_RESULTS_MESSAGE}</p>}

          {people.length > 0 && (
            <>
              <h2>Personas</h2>
              <ul>
                {people.map((person) => (
                  <li key={person.id}>
                    <Link to={peopleUrl} onClick={reset}>
                      <ApiImage src={person.avatarUrl || DEFAULT_AVATAR} alt="" width={32} height={32} />
                      <span>
                        <strong>{fullName(person)}</strong>
                        <small>{person.email}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {allPeople.length > MAX_RESULTS && (
                <Link
                  className="global-search__more"
                  to={peopleUrl}
                  onClick={reset}
                >
                  Ver más en personas
                </Link>
              )}
            </>
          )}

          {matchingGroups.length > 0 && (
            <>
              <h2>Grupos</h2>
              <ul>
                {matchingGroups.map((group) => (
                  <li key={group.id}>
                    <Link to={`/groups/${group.id}`} onClick={reset}>
                      {group.photo ? (
                        <ApiImage className="global-search__mark" src={group.photo} alt="" width={32} height={32} />
                      ) : (
                        <span
                          className="global-search__mark"
                          data-testid="group-avatar-default"
                          aria-hidden="true"
                        >
                          {group.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span>
                        <strong>{group.name}</strong>
                        <small>
                          {group.memberCount === 1
                            ? '1 miembro'
                            : `${group.memberCount} miembros`}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {allMatchingGroups.length > MAX_RESULTS && (
                <Link
                  className="global-search__more"
                  to={groupsUrl}
                  onClick={reset}
                >
                  Ver más en grupos
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
