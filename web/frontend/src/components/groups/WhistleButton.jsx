import { useId, useRef, useState } from 'react'
import { whistleDebt } from '../../api/groupExpensesClient'
import { useAuth } from '../../auth/AuthContext'
import ConfirmModal from '../ConfirmModal'
import { useSnackbar } from '../Snackbar'
import { formatWait, whistleSuccessMessage } from './whistleText'

export const WHISTLE_LIMIT_NOTE = 'Podés avisarle una vez cada 24 horas en este grupo.'
export const SIMULATED_NOTE = 'Los perfiles simulados no reciben avisos'
export const WHISTLE_DELIVERY_ERROR = 'No pudimos enviar el aviso. Probá de nuevo en unos minutos'
export const WHISTLE_NETWORK_ERROR = 'No se pudo enviar el aviso. Revisá tu conexión e intentá de nuevo'

function rateLimitedMessage(name, seconds) {
  return `Ya le avisaste a ${name} hace poco. Vas a poder volver a hacerlo en ${formatWait(seconds)}`
}

// 030 (contracts/debt-whistle.md): "Avisar" for one debt in which the session user is
// the creditor. It confirms with the base modal, calls the API once per confirmation
// and reports the outcome. A 409 means the debt changed under the screen: the message
// goes to the snackbar (the row may disappear) and the list reloads. A simulated debtor
// gets a disabled button with a visible reason (Q3).
export default function WhistleButton({ groupId, debtId, debtorName, amountText, concept, simulated, onStale }) {
  const auth = useAuth()
  const setUser = auth?.setUser
  const showSnackbar = useSnackbar()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const trigger = useRef(null)
  const noteId = useId()
  const name = debtorName || 'esta persona'

  function close() {
    if (busy) return
    setOpen(false)
    setError('')
    trigger.current?.focus?.()
  }

  async function confirm() {
    setBusy(true)
    setError('')
    const result = await whistleDebt(groupId, debtId)
    setBusy(false)
    if (result.ok) {
      setOpen(false)
      showSnackbar?.(whistleSuccessMessage(name))
      return
    }
    if (result.network) {
      setError(WHISTLE_NETWORK_ERROR)
      return
    }
    switch (result.status) {
      case 401:
        setOpen(false)
        setUser?.(null)
        return
      case 409:
        setOpen(false)
        showSnackbar?.(result.detail || WHISTLE_NETWORK_ERROR)
        onStale?.()
        return
      case 429:
        setError(rateLimitedMessage(name, result.retryAfterSeconds))
        return
      case 503:
        setError(result.detail || WHISTLE_DELIVERY_ERROR)
        return
      default:
        setError(result.detail || WHISTLE_NETWORK_ERROR)
    }
  }

  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="group-action"
        aria-label={`Avisar a ${name}`}
        aria-describedby={simulated ? noteId : undefined}
        disabled={Boolean(simulated)}
        onClick={() => setOpen(true)}
      >
        Avisar
      </button>
      {simulated && (
        <small id={noteId} className="group-whistle__note" data-testid="whistle-simulated-note">
          {SIMULATED_NOTE}
        </small>
      )}
      {open && (
        <ConfirmModal
          title={`Avisar a ${name}`}
          confirmLabel="Avisar"
          busyConfirmLabel="Avisando…"
          busy={busy}
          error={error}
          errorTestId="whistle-error"
          testId="whistle-dialog"
          onClose={close}
          onConfirm={confirm}
        >
          <p>
            Le vamos a mandar ahora un correo a {name} para recordarle que te debe {amountText}
            {concept ? ` por «${concept}»` : ''}.
          </p>
          <p>{WHISTLE_LIMIT_NOTE}</p>
        </ConfirmModal>
      )}
    </>
  )
}
