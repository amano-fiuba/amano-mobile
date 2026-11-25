import { useEffect, useState } from 'react'
import {
  deleteGroupPhoto,
  getGroup,
  updateGroup,
  uploadGroupPhoto,
  GROUPS_NETWORK_ERROR_MESSAGE,
} from '../../api/groupsClient'
import GroupPhotoPanel from './GroupPhotoPanel'
import { useSnackbar } from '../Snackbar'
import { prepareImageForUpload } from '../../utils/imagePrep'

/**
 * Edit mode of the group data (photo, name, description). Changes are staged
 * locally and persisted together on "Guardar"; closing the panel ("Cerrar"
 * in the group header) discards them. El plazo de pago y los recordatorios se
 * configuran desde el modal de deudas (028), no acá.
 */
export default function GroupEditForm({ group, onSaved }) {
  const showSnackbar = useSnackbar()
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [newFile, setNewFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL?.(previewUrl)
  }, [previewUrl])

  // Fotos de hasta 25 MB: se achican a un JPG de 2 MB o menos antes de
  // subirlas (utils/imagePrep.js).
  async function handlePick(picked) {
    const prepared = await prepareImageForUpload(picked)
    if (!prepared.ok) {
      setPhotoError(prepared.message)
      return
    }
    const file = prepared.file
    setPhotoError('')
    setNewFile(file)
    setRemovePhoto(false)
    setPreviewUrl(URL.createObjectURL ? URL.createObjectURL(file) : null)
  }

  function handleRemove() {
    setPhotoError('')
    setNewFile(null)
    setPreviewUrl(null)
    setRemovePhoto(true)
  }

  const shownPhoto = previewUrl || (removePhoto ? null : group.photo ?? null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError('El nombre del grupo es obligatorio')
      return
    }
    setSaving(true)
    setError('')

    const payload = {}
    if (name.trim() !== group.name) payload.name = name
    if (description !== (group.description ?? '')) payload.description = description
    if (Object.keys(payload).length) {
      const result = await updateGroup(group.id, payload)
      if (!result.ok) {
        setError(result.network
          ? GROUPS_NETWORK_ERROR_MESSAGE
          : result.fields?.name || result.detail || 'No se pudieron guardar los cambios')
        setSaving(false)
        return
      }
    }

    if (newFile || removePhoto) {
      const result = newFile
        ? await uploadGroupPhoto(group.id, newFile)
        : await deleteGroupPhoto(group.id)
      if (!result || !result.ok) {
        setError(!result || result.network
          ? GROUPS_NETWORK_ERROR_MESSAGE
          : result.detail || 'No se pudo actualizar la foto del grupo')
        setSaving(false)
        return
      }
    }

    const fresh = await getGroup(group.id)
    setSaving(false)
    if (fresh.ok) {
      showSnackbar('Los datos del grupo se actualizaron')
      onSaved(fresh.group)
    } else {
      setError(GROUPS_NETWORK_ERROR_MESSAGE)
    }
  }

  return (
    <form className="group-edit-form" onSubmit={handleSubmit} data-testid="group-edit-form">
      <GroupPhotoPanel
        photo={shownPhoto}
        editing
        onPick={handlePick}
        onRemove={handleRemove}
        error={photoError}
      />
      <label>
        Nombre
        <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Descripción
        <textarea value={description} rows={3} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <p role="alert" data-testid="group-edit-error">{error}</p>}
      {/* Sin Cancelar: el panel se cierra con "Cerrar" en la cabecera. */}
      <div className="form-actions">
        <button type="submit" className="group-action" disabled={saving}>
          Guardar
        </button>
      </div>
    </form>
  )
}
