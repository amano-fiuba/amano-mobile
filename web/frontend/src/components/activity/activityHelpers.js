import { MONTH_NAMES } from '../../validation/months'

// Constants and pure helpers shared by the expense and income views of the personal
// activity (specs/031-buscar-en-actividad-personal, specs/033-income-management).
// Extracted from ActivityPage.jsx without changing their behavior.

// Exact messages of specs/031-buscar-en-actividad-personal, exported for the tests.
export const SEARCH_PLACEHOLDER = 'Buscar por categoría, descripción, medio de pago'
export const TOO_SHORT_MESSAGE = 'Ingresá al menos 2 caracteres para buscar'
export const NO_RESULTS_MESSAGE = 'No se encontraron resultados'

export const MIN_LENGTH = 2
export const MAX_LENGTH = 100
// Pause after the last keystroke before querying (FR-001): one query per pause.
export const DEBOUNCE_MS = 400
export const ALL_YEARS = 'all'
export const ALL_MONTHS = ''
export const MONTHS = MONTH_NAMES

// Page size from the screen height (FR-022, plan D13): the cards that fit below
// the filters without scrolling, between 5 and 20.
export const MIN_PAGE_SIZE = 5
export const MAX_PAGE_SIZE = 20
// Height of one card plus the gap until the first ones are measured.
export const ESTIMATED_ROW_HEIGHT = 86
// Space kept below the list for the counter, the pagination and the page margin.
const RESERVED_HEIGHT = 120
const FILTERS_MARGIN = 16
export const RESIZE_PAUSE_MS = 150
// With more pages than this, only the first, the last and the current with its
// neighbours are shown (FR-021).
const MAX_PLAIN_PAGES = 7

export function currentYear() {
  return String(new Date().getFullYear())
}

export function isSearchable(term) {
  return term.length >= MIN_LENGTH && term.length <= MAX_LENGTH
}


/** Current year, years with expenses (newest first) and the one in the address. */
export function yearOptionsOf(years, selected) {
  const set = new Set([currentYear(), ...years.map(String)])
  if (selected && selected !== ALL_YEARS) {
    set.add(selected)
  }
  return [...set].sort((a, b) => Number(b) - Number(a))
}

// App móvil (mobile 002): la barra inferior tapa el final de la ventana.
const TAB_BAR_HEIGHT = 72

function tabBarHeight() {
  return document.documentElement.dataset.tabBar === 'on' ? TAB_BAR_HEIGHT : 0
}

/** Cards that fit between the filters and the bottom of the window (FR-022). */
export function pageSizeFor(filters, rowHeight) {
  const top = filters ? filters.getBoundingClientRect().bottom + window.scrollY : 0
  const available = window.innerHeight - top - FILTERS_MARGIN - RESERVED_HEIGHT - tabBarHeight()
  const fitting = Math.floor(available / rowHeight)
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, fitting))
}

/** Height of one card plus the gap between cards, or null when not laid out. */
export function rowHeightOf(list) {
  const count = list.children.length
  const height = list.getBoundingClientRect().height
  if (count === 0 || height <= 0) {
    return null
  }
  const gap = Number.parseFloat(window.getComputedStyle(list).rowGap) || 0
  return (height + gap) / count
}


/** Page numbers to show, with '…' in the jumps (FR-021). */
export function pagesOf(current, total) {
  if (total <= MAX_PLAIN_PAGES) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }
  const shown = [1, current - 1, current, current + 1, total]
    .filter((page, index, all) => page >= 1 && page <= total && all.indexOf(page) === index)
    .sort((a, b) => a - b)
  const items = []
  shown.forEach((page, index) => {
    if (index > 0 && page - shown[index - 1] > 1) {
      items.push(`gap-${page}`)
    }
    items.push(page)
  })
  return items
}
