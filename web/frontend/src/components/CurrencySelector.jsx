import { useState } from 'react'
import CurrencyCatalogDialog from './CurrencyCatalogDialog'
import { CURRENCY_OPTIONS, currencyLabel } from '../validation/expenseCatalog'

const BASE_CODES = CURRENCY_OPTIONS.map((option) => option.code)

// Preferred currencies (002 T036, FR-003/FR-011, Q1): multi-select in click
// order; an empty selection persists nothing and the client shows the ARS default.
// 027 (FR-014): besides ARS/USD/EUR, "Ver más…" adds any currency of the BCRA
// catalog. Uncontrolled by default (registration); pass `value` to control it
// (profile edition).
export default function CurrencySelector({ value, onChange, legend = 'Monedas (default ARS)' }) {
  const [internal, setInternal] = useState([])
  const [picked, setPicked] = useState([])
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const selected = value ?? internal

  // Extra currencies stay listed after being unchecked, so they can be checked again.
  const codes = [...new Set([...BASE_CODES, ...selected, ...picked])]

  const update = (next) => {
    if (value === undefined) {
      setInternal(next)
    }
    onChange?.(next)
  }

  const toggle = (code) => {
    if (selected.includes(code)) {
      if (!BASE_CODES.includes(code) && !picked.includes(code)) {
        setPicked((current) => [...current, code])
      }
      update(selected.filter((item) => item !== code))
    } else {
      update([...selected, code])
    }
  }

  const handlePick = (code) => {
    setIsCatalogOpen(false)
    if (!picked.includes(code)) {
      setPicked((current) => [...current, code])
    }
    if (!selected.includes(code)) {
      update([...selected, code])
    }
  }

  return (
    <fieldset className="currency-selector">
      <legend>{legend}</legend>
      {codes.map((code) => (
        <label key={code}>
          <input type="checkbox" checked={selected.includes(code)} onChange={() => toggle(code)} />
          {`${currencyLabel(code)} (${code})`}
        </label>
      ))}
      <button type="button" className="text-button currency-selector__more" onClick={() => setIsCatalogOpen(true)}>
        Ver más…
      </button>
      {isCatalogOpen && (
        <CurrencyCatalogDialog onSelect={handlePick} onClose={() => setIsCatalogOpen(false)} />
      )}
    </fieldset>
  )
}
