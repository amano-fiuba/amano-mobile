// Búsqueda local sobre listas de personas ya cargadas (amigos, solicitudes,
// selector de amigos de un grupo): por nombre completo o correo, sin importar
// mayúsculas ni tildes.

export function fullName(person) {
  return person.lastName ? `${person.firstName} ${person.lastName}` : person.firstName
}

// Lowercase and without accents, so "jose" finds "José".
export function normalizeSearch(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Filters `items` by `query` (raw input). An empty query returns them all.
 * `personOf` picks the person of each item (e.g. the sender of a request).
 */
export function filterPeople(items, query, personOf = (item) => item) {
  const term = normalizeSearch(query.trim())
  if (!term) return items
  return items.filter((item) => {
    const person = personOf(item)
    return [fullName(person), person.email].some((value) => normalizeSearch(value).includes(term))
  })
}
