import { useEffect, useState } from 'react'
import {
  getReminderSettings,
  updateGroup,
  updateReminderSettings,
  GROUPS_NETWORK_ERROR_MESSAGE,
} from '../../api/groupsClient'
import ConfirmModal from '../ConfirmModal'
import { useSnackbar } from '../Snackbar'
import { DEBT_DUE_DAYS_INVALID, DEBT_DUE_DAYS_REQUIRED, parseDueDays } from './debtDueDays'

const FALLBACK_SEND_DAYS = [7, 5, 3, 2, 1]
const MAX_MESSAGE_LENGTH = 500

function sendDaysLabel(days) {
  return days === 1 ? '1 día antes' : `${days} días antes`
}

/**
 * 028: modal único de configuración de deudas del grupo. Centraliza el plazo
 * de pago (`debtDueDays`, usado al crear el gasto) y la configuración de
 * recordatorios de 025 (`sendDays` y mensaje). Sobrevive a los cambios de
 * vencimiento: los vencimientos ya creados no se recalculan.
 */
export default function GroupDebtSettingsModal({ group, isAdmin, onClose, onSaved }) {
  const showSnackbar = useSnackbar()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [hasDueDate, setHasDueDate] = useState(group.debtDueDays != null)
  const [dueDays, setDueDays] = useState(group.debtDueDays == null ? '' : String(group.debtDueDays))
  const [dueDaysError, setDueDaysError] = useState('')
  const [sendDays, setSendDays] = useState(5)
  const [allowedSendDays, setAllowedSendDays] = useState(FALLBACK_SEND_DAYS)
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      return undefined
    }
    let cancelled = false
    getReminderSettings(group.id).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setSendDays(result.settings.sendDays)
        setAllowedSendDays(result.settings.allowedSendDays?.length
          ? result.settings.allowedSendDays
          : FALLBACK_SEND_DAYS)
        setMessage(result.settings.message ?? '')
      } else {
        setLoadError(result.network
          ? GROUPS_NETWORK_ERROR_MESSAGE
          : result.detail || 'No se pudo cargar la configuración de recordatorios')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [group.id, isAdmin, reloadToken])

  if (!isAdmin) {
    return null
  }

  function retry() {
    setLoading(true)
    setLoadError('')
    setReloadToken((token) => token + 1)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const days = hasDueDate ? parseDueDays(dueDays) : null
    if (hasDueDate && days === null) {
      setDueDaysError(DEBT_DUE_DAYS_REQUIRED)
      return
    }
    if (days === undefined) {
      setDueDaysError(DEBT_DUE_DAYS_INVALID)
      return
    }
    setDueDaysError('')
    setFieldErrors({})
    setError('')
    setSaving(true)

    if (days !== (group.debtDueDays ?? null)) {
      const groupResult = await updateGroup(group.id, { debtDueDays: days })
      if (!groupResult.ok) {
        const dueDaysMessage = groupResult.fields?.debtDueDays
        if (dueDaysMessage) setDueDaysError(dueDaysMessage)
        setError(groupResult.network
          ? GROUPS_NETWORK_ERROR_MESSAGE
          : dueDaysMessage ? '' : groupResult.detail || 'No se pudieron guardar los cambios')
        setSaving(false)
        return
      }
    }

    if (hasDueDate) {
      const reminderResult = await updateReminderSettings(group.id, {
        sendDays: Number(sendDays),
        message,
      })
      if (!reminderResult.ok) {
        setSaving(false)
        setFieldErrors(reminderResult.fields ?? {})
        setError(reminderResult.network
          ? GROUPS_NETWORK_ERROR_MESSAGE
          : reminderResult.detail || 'No se pudieron guardar los recordatorios')
        return
      }
    }
    setSaving(false)

    showSnackbar('Configuración de deudas actualizada')
    onSaved?.()
  }

  return (
    <ConfirmModal
      title="Deudas y recordatorios"
      onClose={onClose}
      error={error}
      errorTestId="debt-settings-error"
      testId="debt-settings-dialog"
      busy={saving}
      wide
      describedByBody={false}
    >
      {loading && <p role="status">Cargando…</p>}
      {!loading && loadError && (
        <div>
          <p role="alert" data-testid="debt-settings-load-error">{loadError}</p>
          <button type="button" className="group-action" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}
      {!loading && !loadError && (
        <form className="group-edit-form" onSubmit={handleSubmit} data-testid="debt-settings-form">
          <label className="debt-settings__toggle" htmlFor="has-due-date">
            <input
              id="has-due-date"
              type="checkbox"
              checked={hasDueDate}
              onChange={(event) => {
                setHasDueDate(event.target.checked)
                setDueDaysError('')
              }}
            />
            Las deudas tienen vencimiento
          </label>

          {hasDueDate ? (
            <div className="field">
              <label htmlFor="group-due-days">Días para el vencimiento de las deudas</label>
              <input
                id="group-due-days"
                inputMode="numeric"
                autoComplete="off"
                value={dueDays}
                aria-invalid={dueDaysError ? true : undefined}
                aria-describedby={`group-due-days-hint${dueDaysError ? ' group-due-days-error' : ''}`}
                onChange={(event) => {
                  setDueDays(event.target.value)
                  setDueDaysError('')
                }}
              />
              <p className="field__hint" id="group-due-days-hint">
                Días después de la fecha del gasto. Aplica a los gastos nuevos.
              </p>
              {dueDaysError && (
                <p role="alert" id="group-due-days-error" data-testid="group-due-days-error">
                  {dueDaysError}
                </p>
              )}
            </div>
          ) : (
            <p className="field__hint" data-testid="no-due-date-hint">
              Las deudas no vencen y no se envían recordatorios.
            </p>
          )}

          {hasDueDate && (
            <>
              <h4>Recordatorios de deudas</h4>
              <label htmlFor="reminder-send-days">Cuándo enviar el recordatorio</label>
              <select
                id="reminder-send-days"
                value={sendDays}
                onChange={(event) => setSendDays(Number(event.target.value))}
              >
                {allowedSendDays.map((days) => (
                  <option key={days} value={days}>
                    {sendDaysLabel(days)}
                  </option>
                ))}
              </select>
              {fieldErrors.sendDays && <p role="alert">{fieldErrors.sendDays}</p>}

              <label htmlFor="reminder-message">Mensaje personalizado (opcional)</label>
              <textarea
                id="reminder-message"
                maxLength={MAX_MESSAGE_LENGTH}
                rows={2}
                value={message}
                aria-describedby="reminder-message-counter"
                onChange={(event) => setMessage(event.target.value)}
              />
              <p id="reminder-message-counter" data-testid="reminder-message-counter">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </p>
              {fieldErrors.message && <p role="alert">{fieldErrors.message}</p>}
            </>
          )}

          <div className="form-actions">
            <button type="submit" className="group-action" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </ConfirmModal>
  )
}
