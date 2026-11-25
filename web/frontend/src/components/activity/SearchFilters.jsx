import { useState } from 'react'
import { FilterIcon, SearchIcon } from '../NavIcons'
import { isMobileLayout } from '../../mobile/mobileLayout'
import {
  ALL_MONTHS,
  ALL_YEARS,
  MAX_LENGTH,
  MONTHS,
  SEARCH_PLACEHOLDER,
  TOO_SHORT_MESSAGE,
  yearOptionsOf,
} from './activityHelpers'

/**
 * Search field with a magnifier, month and year selectors of the personal activity
 * (031), shared by the expense and income views (033). It only draws the controls: the
 * page owns the term, the criteria in force and the handlers.
 */
export default function SearchFilters({
  formRef,
  term,
  month,
  year,
  years,
  onTermChange,
  onMonthChange,
  onYearChange,
  onSubmit,
  mobile = isMobileLayout(),
}) {
  // App móvil (mobile 002): mes y año se despliegan con "Filtros" para dejar lugar a
  // la lista. Si hay un mes elegido, el botón lo indica.
  const [showFilters, setShowFilters] = useState(false)
  const filtered = month !== ALL_MONTHS || year === ALL_YEARS
  return (
  <form
    ref={formRef}
    className="activity-search"
    role="search"
    onSubmit={onSubmit}
    noValidate
  >
    <div className="activity-search__row">
      <div className="activity-search__field">
        <SearchIcon />
        <input
          type="search"
          aria-label={SEARCH_PLACEHOLDER}
          placeholder={SEARCH_PLACEHOLDER}
          maxLength={MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="search"
          value={term}
          onChange={onTermChange}
        />
      </div>
      {mobile && (
        <button
          type="button"
          className={`activity-search__toggle${filtered ? ' is-filtered' : ''}`}
          aria-expanded={showFilters}
          aria-controls="activity-search-selects"
          onClick={() => setShowFilters((open) => !open)}
        >
          <FilterIcon />
          <span className="visually-hidden">Filtros por mes y año</span>
        </button>
      )}
      <div
        className="activity-search__selects"
        id="activity-search-selects"
        hidden={mobile && !showFilters}
      >
        <select
          className="list-search__sort"
          aria-label="Mes"
          value={month}
          disabled={year === ALL_YEARS}
          onChange={onMonthChange}
        >
          <option value={ALL_MONTHS}>Todos los meses</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="list-search__sort"
          aria-label="Año"
          value={year}
          onChange={onYearChange}
        >
          {yearOptionsOf(years, year).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={ALL_YEARS}>Todos los años</option>
        </select>
      </div>
    </div>
    {term.trim().length === 1 && <p className="activity-search__notice">{TOO_SHORT_MESSAGE}</p>}
  </form>
  )
}
