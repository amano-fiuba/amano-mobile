import { pagesOf } from './activityHelpers'

/** Anterior, page numbers and Siguiente (031, FR-021), shared by both activity views. */
export default function Pagination({ page, totalPages, onChange }) {
  return (
    <nav className="activity-pagination" aria-label="Paginación">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ‹ Anterior
      </button>
      <ol>
        {pagesOf(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <button
                type="button"
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onChange(item)}
              >
                {item}
              </button>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="activity-pagination__gap">
              …
            </li>
          ),
        )}
      </ol>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Siguiente ›
      </button>
    </nav>
  )
}
