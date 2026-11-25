import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './ChoiceDialog.scss'

export const SUMMARY_TITLE = 'Confirmá el gasto'
export const SUMMARY_CONFIRM_LABEL = 'Confirmar'
export const SUMMARY_BACK_LABEL = 'Volver'

/**
 * Final summary before saving an expense (027, pedido del 2026-11-08): what will
 * be saved, and "Confirmar" / "Volver". Going back keeps everything that was
 * typed. `title` defaults to the expense one (033 passes the income title); `rows` are { label, value } pairs; `shares` (optional) the split per person.
 */
export default function ExpenseSummaryDialog({
  title = SUMMARY_TITLE,
  rows,
  shares,
  error,
  confirming = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId()
  const confirmRef = useRef(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && !confirming) {
      event.stopPropagation()
      onCancel()
    }
  }

  return createPortal(
    <div className="choice-dialog__backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="choice-dialog expense-summary"
        onKeyDown={handleKeyDown}
      >
        <h3 id={titleId}>{title}</h3>
        <div className="expense-summary__body">
          <dl className="expense-summary__rows">
            {rows.map(({ label, value }) => (
              <div key={label} className="expense-summary__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {shares?.length > 0 && (
            <>
              <h4 className="expense-summary__subtitle">Parte de cada uno</h4>
              <ul className="expense-summary__shares" aria-label="Parte de cada uno">
                {shares.map(({ name, amount }) => (
                  <li key={name}>
                    <span>{name}</span>
                    <span>{amount}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="expense-summary__error">
            {error}
          </p>
        )}
        <div className="choice-dialog__actions">
          <button type="button" className="choice-dialog__cancel" disabled={confirming} onClick={onCancel}>
            {SUMMARY_BACK_LABEL}
          </button>
          <button type="button" ref={confirmRef} disabled={confirming} onClick={onConfirm}>
            {confirming ? 'Guardando…' : SUMMARY_CONFIRM_LABEL}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
