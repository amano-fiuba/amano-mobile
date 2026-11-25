import { useId, useState } from 'react'
import CurrencyCatalogDialog from './CurrencyCatalogDialog'
import { ALL_CURRENCY_OPTIONS, codesOf, currencyLabel } from '../validation/expenseCatalog'

export const MORE_CURRENCIES_LABEL = 'Ver más…'
const MORE_VALUE = '__more__'
const SUPPORTED = codesOf(ALL_CURRENCY_OPTIONS)

/**
 * Currency select of the expense forms (027, FR-011 a FR-013): the user's
 * preferred currencies first (ARS when there are none), then the current value
 * and any currency picked earlier if they are not preferred, and finally
 * "Ver más…", which opens the BCRA catalog instead of changing the value.
 * Controlled: use it through react-hook-form's Controller.
 */
export default function CurrencySelect({
  label = 'Moneda',
  preferred,
  value,
  onChange,
  onBlur,
  name,
  ref,
  error,
}) {
  const id = useId()
  const [picked, setPicked] = useState([])
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)

  const own = (Array.isArray(preferred) ? preferred : []).filter((code) => SUPPORTED.includes(code))
  const codes = [...new Set([...(own.length > 0 ? own : ['ARS']), value, ...picked].filter(Boolean))]

  const handleChange = (event) => {
    if (event.target.value === MORE_VALUE) {
      setIsCatalogOpen(true)
      return
    }
    onChange?.(event.target.value)
  }

  const handlePick = (code) => {
    setPicked((current) => (current.includes(code) ? current : [...current, code]))
    setIsCatalogOpen(false)
    onChange?.(code)
  }

  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={error ? 'field field--invalid' : 'field'}>
      <label htmlFor={id}>{label}</label>
      <select
        ref={ref}
        id={id}
        name={name}
        value={value ?? ''}
        onChange={handleChange}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      >
        {codes.map((code) => (
          <option key={code} value={code}>
            {currencyLabel(code)}
          </option>
        ))}
        <option value={MORE_VALUE}>{MORE_CURRENCIES_LABEL}</option>
      </select>
      {error && (
        <p role="alert" id={errorId} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
      {isCatalogOpen && (
        <CurrencyCatalogDialog
          initialCode={value}
          onSelect={handlePick}
          onClose={() => setIsCatalogOpen(false)}
        />
      )}
    </div>
  )
}
