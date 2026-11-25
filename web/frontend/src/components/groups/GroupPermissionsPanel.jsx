import { useState } from 'react'
import { updateGroup, GROUPS_NETWORK_ERROR_MESSAGE } from '../../api/groupsClient'
import { useSnackbar } from '../Snackbar'

const CHECKBOXES = [
  { key: 'membersCannotMakeExpenses', label: 'No podrán hacer gastos' },
  { key: 'membersCannotInvite', label: 'No podrán invitar gente' },
  { key: 'membersCanEditGroupData', label: 'Pueden editar datos del grupo' },
  { key: 'membersCanManageSimulatedProfiles', label: 'Pueden administrar perfiles simulados' },
  { key: 'membersCanGenerateExpensesForOthers', label: 'Pueden generar gastos en nombre de otras personas' },
  { key: 'paymentsRequireValidation', label: 'Los pagos requieren validación' },
]

// `onSaved` lets the group screen close the panel and re-fetch the group after
// a successful save, like the edit form does.
export default function GroupPermissionsPanel({ group, permissions, onSaved }) {
  const showSnackbar = useSnackbar()
  const [values, setValues] = useState({ ...permissions })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggle(key) {
    setValues((current) => ({ ...current, [key]: !current[key] }))
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    const result = await updateGroup(group.id, { permissions: values })
    if (result.ok) {
      setValues({ ...values, ...(result.group?.permissions ?? {}) })
      showSnackbar('Permisos actualizados')
      setSaving(false)
      onSaved?.()
      return
    } else if (result.network) {
      setError(GROUPS_NETWORK_ERROR_MESSAGE)
    } else {
      setError(result.detail || 'No se pudieron guardar los permisos')
    }
    setSaving(false)
  }

  return (
    <section className="group-permissions" data-testid="permissions-panel">
      <h3>Permisos de los miembros</h3>
      {CHECKBOXES.map(({ key, label }) => (
        <div key={key}>
          <label>
            <input
              type="checkbox"
              checked={Boolean(values[key])}
              onChange={() => toggle(key)}
            />{' '}
            {label}
          </label>
        </div>
      ))}
      <button type="button" className="group-action" onClick={handleSubmit} disabled={saving}>
        Guardar
      </button>
      {error && (
        <p role="alert" data-testid="permissions-error">
          {error}
        </p>
      )}
    </section>
  )
}
