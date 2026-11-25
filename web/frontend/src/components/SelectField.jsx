import { useId } from 'react'

// Reusable select field (T025; FR-008, FR-033), following TextField: associated
// label, accessible invalid state and the error message announced by role=alert.
// Options keep the catalog shape { code, label } of expenseCatalog.js; the empty
// option lets FR-032 reset category/type/paymentMethod with no selection; pass
// `placeholder={null}` for a field that always has a value (e.g. group currency).
export default function SelectField({
  label,
  error,
  options,
  placeholder = 'Seleccioná una opción',
  ...selectProps
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : undefined

  return (
    <div className={error ? 'field field--invalid' : 'field'}>
      <label htmlFor={id}>{label}</label>
      <select
        {...selectProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {options.map(({ code, label: optionLabel }) => (
          <option key={code} value={code}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" id={`${id}-error`} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
