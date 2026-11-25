// Presentación de un grupo compartida entre "Mis grupos" y la pantalla principal.

export function byLatestActivity(groups) {
  return [...groups].sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt))
}

export function formatActivityDate(isoDateTime) {
  return new Date(isoDateTime).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function memberCountLabel(count) {
  return count === 1 ? '1 miembro' : `${count} miembros`
}

// Orden de "Mis grupos". Por defecto, la actividad más reciente primero.
export const GROUP_SORT_OPTIONS = [
  { code: 'recent', label: 'Actividad: más reciente' },
  { code: 'oldest', label: 'Actividad: más antigua' },
  { code: 'name', label: 'Nombre (A–Z)' },
  { code: 'name-desc', label: 'Nombre (Z–A)' },
]

const byName = (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })

export function sortGroups(groups, order) {
  switch (order) {
    case 'oldest':
      return byLatestActivity(groups).reverse()
    case 'name':
      return [...groups].sort(byName)
    case 'name-desc':
      return [...groups].sort((a, b) => byName(b, a))
    default:
      return byLatestActivity(groups)
  }
}
