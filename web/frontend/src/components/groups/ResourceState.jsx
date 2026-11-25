export const LOADING_MESSAGE = 'Cargando…'

// Loading, error (with retry) and empty states shared by the panels of the debts
// screen (022 T074). Renders `children` only when the resource is ready and not empty.
export default function ResourceState({ resource, isEmpty, emptyMessage, children }) {
  if (resource.status === 'loading') {
    return (
      <div role="status" className="group-debts__state">
        <span className="button-spinner" aria-hidden="true" />
        <p>{LOADING_MESSAGE}</p>
      </div>
    )
  }
  if (resource.status === 'error') {
    return (
      <div role="alert" className="group-debts__state" data-testid="debts-error">
        <p>{resource.error}</p>
        <button type="button" className="group-action" onClick={resource.retry}>
          Reintentar
        </button>
      </div>
    )
  }
  if (isEmpty) {
    return (
      <p className="group-debts__state" data-testid="debts-empty">
        {emptyMessage}
      </p>
    )
  }
  return children
}
