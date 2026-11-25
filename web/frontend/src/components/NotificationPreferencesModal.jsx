import { useCallback, useEffect, useRef, useState } from 'react'
import { getPreferences, updatePreferences } from '../api/notificationsClient'
import { useSnackbar } from './Snackbar'
import './NotificationPreferencesModal.scss'

export const PREFERENCES_SAVED_MESSAGE = 'Preferencias de notificaciones guardadas'
export const PREFERENCES_SAVE_ERROR_MESSAGE = 'No pudimos guardar tus preferencias. Intentá nuevamente'

const CHANNELS = [
  { key: 'inApp', label: 'In-App (bandeja)' },
  { key: 'email', label: 'Correo electrónico' },
]
const EVENT_TYPES = [
  { key: 'remindersAndWhistles', label: 'Recordatorios y silbatos de cobro' },
  { key: 'debtDueAndPendingCollections', label: 'Vencimiento de deudas y cobros pendientes' },
  { key: 'groupActivity', label: 'Actividad de grupo' },
  { key: 'friendActivity', label: 'Solicitudes de amistad y actividad social' },
]
const ALL_KEYS = [...CHANNELS.map((field) => field.key), ...EVENT_TYPES.map((field) => field.key)]

function enabledByDefault() {
  return Object.fromEntries(ALL_KEYS.map((key) => [key, true]))
}

/** Inline preferences panel of the inbox (035 US4), like the group settings panel. */
export default function NotificationPreferencesModal({ open, onClose }) {
  const showSnackbar = useSnackbar()
  const [values, setValues] = useState(enabledByDefault)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const onCloseRef = useRef(onClose)
  const returnFocusRef = useRef(null)
  const firstControlRef = useRef(null)
  const handleClose = useCallback(() => onCloseRef.current?.(), [])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    returnFocusRef.current = document.activeElement
    let cancelled = false
    const load = async () => {
      // Defer state updates to a microtask: effects must not set state synchronously.
      await Promise.resolve()
      if (cancelled) return
      setError('')
      setBusy(true)
      const result = await getPreferences()
      if (cancelled) return
      setBusy(false)
      if (!result.ok) {
        setError(result.detail || PREFERENCES_SAVE_ERROR_MESSAGE)
        return
      }
      const preferences = result.preferences ?? {}
      setValues({
        inApp: preferences.channels?.inApp ?? true,
        email: preferences.channels?.email ?? true,
        remindersAndWhistles: preferences.eventTypes?.remindersAndWhistles ?? true,
        debtDueAndPendingCollections: preferences.eventTypes?.debtDueAndPendingCollections ?? true,
        groupActivity: preferences.eventTypes?.groupActivity ?? true,
        friendActivity: preferences.eventTypes?.friendActivity ?? true,
      })
    }
    load()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    firstControlRef.current?.focus?.()
    return () => {
      cancelled = true
      document.removeEventListener('keydown', onKeyDown)
      returnFocusRef.current?.focus?.()
    }
  }, [open, handleClose])

  if (!open) return null

  const toggle = (key) => (event) => {
    setValues((current) => ({ ...current, [key]: event.target.checked }))
  }

  async function save() {
    setBusy(true)
    setError('')
    const payload = {
      channels: { inApp: values.inApp, email: values.email },
      eventTypes: {
        remindersAndWhistles: values.remindersAndWhistles,
        debtDueAndPendingCollections: values.debtDueAndPendingCollections,
        groupActivity: values.groupActivity,
        friendActivity: values.friendActivity,
      },
    }
    const result = await updatePreferences(payload)
    if (result.ok) {
      showSnackbar?.(PREFERENCES_SAVED_MESSAGE)
      onCloseRef.current?.()
      return
    }
    setBusy(false)
    setError(result.detail || PREFERENCES_SAVE_ERROR_MESSAGE)
  }

  return (
    <section className="notification-preferences-panel" role="region"
      aria-label="Configuración de notificaciones" aria-labelledby="preferences-title">
      <div className="notification-preferences-panel__content">
        <h2 id="preferences-title">Configuración de notificaciones</h2>
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={busy}>
          <legend>Canales</legend>
          {CHANNELS.map((field, index) => (
            <label key={field.key} htmlFor={`pref-${field.key}`}>
              <input
                ref={index === 0 ? firstControlRef : undefined}
                id={`pref-${field.key}`}
                type="checkbox"
                checked={values[field.key]}
                onChange={toggle(field.key)}
              />
              {field.label}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Tipos de evento</legend>
          {EVENT_TYPES.map((field) => (
            <label key={field.key} htmlFor={`pref-${field.key}`}>
              <input
                id={`pref-${field.key}`}
                type="checkbox"
                checked={values[field.key]}
                onChange={toggle(field.key)}
              />
              {field.label}
            </label>
          ))}
        </fieldset>
        <div className="notification-preferences-panel__actions">
          <button type="button" className="notifications-page__button" onClick={handleClose}>Cancelar</button>
          <button
            type="button"
            className="notifications-page__button notifications-page__button--primary"
            onClick={save}
            disabled={busy}
          >
            Guardar
          </button>
        </div>
      </div>
    </section>
  )
}
