import '../../pages/groups/groups.scss'

// Filas de carga de las pantallas de grupos.
export default function GroupRowsSkeleton({ rows = 3 }) {
  return (
    <div aria-busy="true">
      <span className="visually-hidden">Cargando…</span>
      <ul className="group-rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, row) => (
          <li key={row} className="group-row group-row--skeleton">
            <span className="group-row__mark" />
            <span className="group-row__body">
              <span className="group-row__line" />
              <span className="group-row__line group-row__line--short" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
