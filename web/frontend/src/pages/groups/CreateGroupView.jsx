import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GROUPS_NETWORK_ERROR_MESSAGE, createGroup } from '../../api/groupsClient'

import FriendPicker from '../../components/groups/FriendPicker'
import PeopleChips from '../../components/groups/PeopleChips'
import { fullName } from '../../utils/personSearch'
import { useSnackbar } from '../../components/Snackbar'
import SelectField from '../../components/SelectField'
import SubmitButton from '../../components/SubmitButton'
import TextField from '../../components/TextField'
import { CURRENCY_OPTIONS } from '../../validation/expenseCatalog'

// Exact messages of the UI contract; exported for the tests.
export const NAME_REQUIRED_MESSAGE = 'El nombre del grupo es obligatorio'
export const MEMBER_REQUIRED_MESSAGE =
  'Agregá al menos un miembro adicional (amigo registrado o perfil simulado)'
const SIMULATED_REQUIRED_MESSAGE = 'Ingresá nombre y correo del perfil simulado'
const SIMULATED_REPEATED_MESSAGE = 'No podés repetir el correo de un perfil simulado'

const EMPTY_DRAFT = { name: '', email: '' }

function firstNameOf(group) {
  return group?.name || 'Grupo'
}

function peopleLabel(count) {
  return count === 1 ? '1 persona elegida' : `${count} personas elegidas`
}

/**
 * Create-group screen (010 FR-001, 023 US5): name (required), optional
 * description and at least one additional member, chosen from the friends list
 * and/or added as simulated profiles. Errors come inline; success opens the
 * new group.
 */
export default function CreateGroupView() {
  const showSnackbar = useSnackbar()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const [fields, setFields] = useState({ name: '', description: '', primaryCurrency: 'ARS' })
  const [errors, setErrors] = useState({})

  const [friends, setFriends] = useState([])
  const [simulated, setSimulated] = useState([])
  const [showSimulatedForm, setShowSimulatedForm] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  function isRepeated(email, profiles = simulated) {
    return profiles.some((profile) => profile.email.toLowerCase() === email.toLowerCase())
  }

  // The profile being typed, validated; `null` when the form is empty.
  function readDraft() {
    const profile = { name: draft.name.trim(), email: draft.email.trim() }
    if (!profile.name && !profile.email) return { profile: null }
    if (!profile.name || !profile.email) return { error: SIMULATED_REQUIRED_MESSAGE }
    if (isRepeated(profile.email)) return { error: SIMULATED_REPEATED_MESSAGE }
    return { profile }
  }

  function addSimulated() {
    const { profile, error } = readDraft()
    if (error || !profile) {
      setErrors((prev) => ({ ...prev, member: error || SIMULATED_REQUIRED_MESSAGE }))
      return
    }
    setSimulated((prev) => [...prev, profile])
    setDraft(EMPTY_DRAFT)
    setShowSimulatedForm(false)
    setErrors((prev) => ({ ...prev, member: undefined }))
  }

  function removeSimulated(email) {
    setSimulated((prev) => prev.filter((profile) => profile.email !== email))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const { profile, error } = readDraft()
    const profiles = profile ? [...simulated, profile] : simulated
    const memberCount = friends.length + profiles.length

    const nextErrors = {}
    if (!fields.name.trim()) nextErrors.name = NAME_REQUIRED_MESSAGE
    if (error) nextErrors.member = error
    else if (memberCount === 0) nextErrors.member = MEMBER_REQUIRED_MESSAGE
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    const result = await createGroup({
      name: fields.name.trim(),
      description: fields.description.trim(),
      primaryCurrency: fields.primaryCurrency,
      members: [
        ...friends.map((friend) => ({ memberType: 'REGISTERED', identifier: friend.email })),
        ...profiles.map(({ name, email }) => ({
          memberType: 'SIMULATED',
          identifier: email,
          name,
        })),
      ],
    })
    setSaving(false)
    if (result.ok) {
      showSnackbar(`Grupo creado: ${firstNameOf(result.group)}`)
      navigate(`/groups/${result.group.id}`, { replace: true })
    } else if (result.network) {
      setErrors({ member: GROUPS_NETWORK_ERROR_MESSAGE })
    } else {
      const { name, member, identifier, primaryCurrency } = result.fields ?? {}
      setErrors({ name, member: member || identifier, primaryCurrency })
    }
  }

  const memberCount = friends.length + simulated.length
  // Crear se habilita con los obligatorios completos: nombre y al menos una
  // persona (elegida o el perfil simulado que se está escribiendo).
  const canCreate =
    fields.name.trim() !== '' && (memberCount > 0 || Boolean(readDraft().profile))

  return (
    <main className="page create-group">
      <h1>Crear nuevo grupo</h1>
      <form onSubmit={handleSubmit} noValidate>
        <TextField
          id="group-name"
          label="Nombre del grupo"
          value={fields.name}
          onChange={(event) => setFields((prev) => ({ ...prev, name: event.target.value }))}
          error={errors.name}
        />
        <TextField
          id="group-description"
          label="Descripción (opcional)"
          value={fields.description}
          onChange={(event) => setFields((prev) => ({ ...prev, description: event.target.value }))}
          error={errors.description}
        />
        <SelectField
          label="Moneda principal"
          options={CURRENCY_OPTIONS}
          placeholder={null}
          value={fields.primaryCurrency}
          onChange={(event) => setFields((prev) => ({ ...prev, primaryCurrency: event.target.value }))}
          error={errors.primaryCurrency}
        />

        <fieldset className="create-group__members">
          <legend>¿Quiénes participan?</legend>
          {/* Amigos y perfiles simulados elegidos, juntos en fichas. */}
          <PeopleChips
            people={[
              ...friends.map((friend) => ({
                key: `friend-${friend.id}`,
                name: fullName(friend),
                detail: friend.email,
                avatarUrl: friend.avatarUrl,
                onRemove: () => setFriends((prev) => prev.filter(({ id }) => id !== friend.id)),
              })),
              ...simulated.map(({ name, email }) => ({
                key: `simulated-${email}`,
                name,
                detail: email,
                simulated: true,
                onRemove: () => removeSimulated(email),
              })),
            ]}
          />
          <FriendPicker selected={friends} onChange={setFriends} />

          {showSimulatedForm ? (
            <div className="create-group__simulated">
              <TextField
                id="simulated-name"
                label="Nombre del perfil simulado"
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
              <TextField
                id="simulated-email"
                label="Correo del perfil simulado"
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
              />
              <button type="button" className="group-action" onClick={addSimulated}>
                Agregar perfil
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="group-action"
              onClick={() => setShowSimulatedForm(true)}
            >
              Sumar perfil simulado
            </button>
          )}

          <p className="create-group__count" aria-live="polite" data-testid="member-count">
            {peopleLabel(memberCount)}
          </p>
          {errors.member && (
            <p role="alert" className="create-group__error" data-testid="member-error">
              {errors.member}
            </p>
          )}
        </fieldset>

        {/* Cancelar a la izquierda y Crear a la derecha. */}
        <div className="form-actions form-actions--split">
          <button type="button" disabled={saving} onClick={() => navigate('/groups')}>
            Cancelar
          </button>
          <SubmitButton loading={saving} disabled={!canCreate}>
            Crear
          </SubmitButton>
        </div>
      </form>
    </main>
  )
}
