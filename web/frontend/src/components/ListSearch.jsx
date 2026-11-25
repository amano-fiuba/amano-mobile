import { Link } from 'react-router'

export const LIST_SEARCH_PLACEHOLDER = 'Buscá por nombre o mail'

/**
 * Buscador de una tarjeta con listado (Mis amigos, Solicitudes pendientes). Va
 * justo debajo del título; el filtrado lo hace quien lo usa (filterPeople).
 * `label` nombra al campo para lectores de pantalla ("Buscar en Mis amigos").
 */
export default function ListSearch({
  label,
  value,
  onChange,
  placeholder = LIST_SEARCH_PLACEHOLDER,
  children,
}) {
  // The wrapper reserves the same scrollbar gutter as the list below, so the
  // input and the cards always have the same width. `children` go next to the
  // input (e.g. the sort selector of Mis amigos).
  return (
    <div className="list-search">
      <input
        type="search"
        className="list-search__input"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {children}
    </div>
  )
}

/**
 * Aviso cuando el buscador de la tarjeta no encuentra a nadie: sugiere buscar
 * entre todos los usuarios, llevando lo que se escribió (`?q=`).
 */
export function ListSearchNoMatches({ message, query }) {
  const term = query.trim()
  const to = term ? `/users/search?q=${encodeURIComponent(term)}` : '/users/search'
  return (
    <div className="friends-requests__empty friends-list__empty" role="status">
      <p>{message}</p>
      <Link to={to} className="friends-list__search-link">
        Buscar usuarios
      </Link>
    </div>
  )
}
