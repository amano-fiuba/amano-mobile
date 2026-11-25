import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { parseArgentineDate } from '../validation/expenseValidation'
import './DatePickerField.scss'

const WEEKDAYS = [
  { short: 'lu', long: 'lunes' },
  { short: 'ma', long: 'martes' },
  { short: 'mi', long: 'miércoles' },
  { short: 'ju', long: 'jueves' },
  { short: 'vi', long: 'viernes' },
  { short: 'sá', long: 'sábado' },
  { short: 'do', long: 'domingo' },
]

const MONTH_NAME = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' })
// "Noviembre 2026" (capitalized by CSS), not "noviembre de 2026".
const monthTitle = (date) => `${MONTH_NAME.format(date)} ${date.getUTCFullYear()}`
const DAY_FORMAT = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const pad = (number) => String(number).padStart(2, '0')

// Dates travel as ISO `yyyy-MM-dd` strings and are built in UTC, so the device
// time zone can never shift a day.
function toIso(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function fromIso(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(iso, days) {
  const date = fromIso(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

// Same day of the month in another month, clamped to its last day (31/03 → 30/04).
function addMonths(iso, months) {
  const date = fromIso(iso)
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return toIso(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay))
}

function toArgentine(iso) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function todayIso() {
  const now = new Date()
  return toIso(now.getFullYear(), now.getMonth(), now.getDate())
}

// 6 weeks × 7 days starting on Monday; days of other months are null.
function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1
    return day >= 1 && day <= days ? toIso(year, month, day) : null
  })
  return Array.from({ length: 6 }, (_, week) => cells.slice(week * 7, week * 7 + 7)).filter((week) =>
    week.some(Boolean),
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  )
}

/**
 * Date field with a calendar on its right (027, FR-010, research.md R6). The
 * value stays the `dd/mm/aaaa` text the expense forms already validate, so typing
 * by hand keeps working; the calendar only fills it. `max` (ISO) disables later
 * days (007 forbids future dates). Controlled: use it through react-hook-form's
 * Controller (`value`, `onChange(text)`, `onBlur`, `name`, `ref`).
 */
export default function DatePickerField({ label, value, onChange, onBlur, name, ref, max, error }) {
  const id = useId()
  const [isOpen, setIsOpen] = useState(false)
  const parsed = parseArgentineDate(value)
  const selectedIso = parsed.ok ? parsed.iso : null
  const [focusedIso, setFocusedIso] = useState(null)
  const containerRef = useRef(null)
  const toggleRef = useRef(null)
  const gridRef = useRef(null)
  // Opening and arrow keys move the focus into the grid; the month buttons keep it.
  const focusGrid = useRef(false)

  const close = useCallback(() => setIsOpen(false), [])
  useDismiss(containerRef, isOpen, close)

  const clampToMax = (iso) => (max && iso > max ? max : iso)

  // Focus follows the focused day while the calendar is open.
  useEffect(() => {
    if (isOpen && focusedIso && focusGrid.current) {
      focusGrid.current = false
      gridRef.current?.querySelector(`[data-iso="${focusedIso}"]`)?.focus()
    }
  }, [isOpen, focusedIso])

  const open = () => {
    focusGrid.current = true
    setFocusedIso(clampToMax(selectedIso ?? todayIso()))
    setIsOpen(true)
  }

  const closeAndReturnFocus = () => {
    setIsOpen(false)
    toggleRef.current?.focus()
  }

  const pick = (iso) => {
    onChange?.(toArgentine(iso))
    closeAndReturnFocus()
  }

  const handleGridKeyDown = (event) => {
    if (!focusedIso) {
      return
    }
    const moves = {
      ArrowLeft: () => addDays(focusedIso, -1),
      ArrowRight: () => addDays(focusedIso, 1),
      ArrowUp: () => addDays(focusedIso, -7),
      ArrowDown: () => addDays(focusedIso, 7),
      PageUp: () => addMonths(focusedIso, -1),
      PageDown: () => addMonths(focusedIso, 1),
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      focusGrid.current = true
      setFocusedIso(clampToMax(move()))
    }
  }

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      // Only the calendar closes: the document-level Escape of useDismiss must not run.
      event.preventDefault()
      event.stopPropagation()
      closeAndReturnFocus()
    }
  }

  const shownIso = focusedIso ?? selectedIso ?? todayIso()
  const shownDate = fromIso(shownIso)
  const year = shownDate.getUTCFullYear()
  const month = shownDate.getUTCMonth()
  const nextMonthStart = toIso(month === 11 ? year + 1 : year, (month + 1) % 12, 1)
  const canGoNext = !max || nextMonthStart <= max
  const today = todayIso()
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={error ? 'field field--invalid date-field' : 'field date-field'} ref={containerRef}>
      <label htmlFor={id}>{label}</label>
      <div className="date-field__control">
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          autoComplete="off"
          value={value ?? ''}
          onChange={(event) => onChange?.(event.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        />
        <button
          ref={toggleRef}
          type="button"
          className="date-field__toggle"
          aria-label="Abrir calendario"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => (isOpen ? close() : open())}
        >
          <CalendarIcon />
        </button>
      </div>
      {isOpen && (
        <div role="dialog" aria-label="Elegir fecha" className="date-field__popover" onKeyDown={handleDialogKeyDown}>
          <div className="date-field__header">
            <button
              type="button"
              className="date-field__nav"
              aria-label="Mes anterior"
              onClick={() => setFocusedIso(addMonths(shownIso, -1))}
            >
              ‹
            </button>
            <p className="date-field__month" aria-live="polite">
              {monthTitle(shownDate)}
            </p>
            <button
              type="button"
              className="date-field__nav"
              aria-label="Mes siguiente"
              disabled={!canGoNext}
              onClick={() => setFocusedIso(clampToMax(addMonths(shownIso, 1)))}
            >
              ›
            </button>
          </div>
          <table role="grid" className="date-field__grid" ref={gridRef} onKeyDown={handleGridKeyDown}>
            <thead>
              <tr>
                {WEEKDAYS.map((weekday) => (
                  <th key={weekday.short} scope="col" abbr={weekday.long}>
                    {weekday.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(year, month).map((week) => (
                <tr key={week.find(Boolean)}>
                  {week.map((iso, index) => {
                    if (!iso) {
                      return <td key={`empty-${index}`} />
                    }
                    const isSelected = iso === selectedIso
                    const classes = [
                      'date-field__day',
                      isSelected ? 'is-selected' : '',
                      iso === today ? 'is-today' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <td key={iso} aria-selected={isSelected}>
                        <button
                          type="button"
                          data-iso={iso}
                          className={classes}
                          tabIndex={iso === focusedIso ? 0 : -1}
                          disabled={Boolean(max) && iso > max}
                          aria-label={DAY_FORMAT.format(fromIso(iso))}
                          aria-current={iso === today ? 'date' : undefined}
                          onClick={() => pick(iso)}
                        >
                          {Number(iso.slice(8))}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && (
        <p role="alert" id={errorId} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
