import { useRef } from 'react'
import { CameraIcon } from '../NavIcons'
import ApiImage from '../ApiImage'

const DEFAULT_AVATAR = '/avatar-default.png'

/**
 * Group photo. Read-only by default; with `editing` it offers "Subir foto" and
 * "Eliminar foto". It is controlled: the parent (GroupEditForm) stages the
 * change and only persists it on "Guardar cambios".
 */
export default function GroupPhotoPanel({
  photo = null,
  editing = false,
  onPick,
  onRemove,
  error = '',
}) {
  const inputRef = useRef(null)

  return (
    <section data-testid="group-photo" aria-label="Foto del grupo" className="group-photo">
      <div className="group-photo__frame">
        <ApiImage
          src={photo || DEFAULT_AVATAR}
          alt=""
          width={96}
          height={96}
          data-testid="group-photo-image"
        />
        {editing && (
          <>
            <label className="visually-hidden" htmlFor="group-photo-input">Subir foto del grupo</label>
            <input
              id="group-photo-input"
              ref={inputRef}
              type="file"
              accept="image/*"
              data-testid="group-photo-input"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onPick?.(file)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              className="group-photo__change"
              aria-label="Subir foto"
              onClick={() => inputRef.current?.click()}
            >
              <CameraIcon />
            </button>
          </>
        )}
      </div>
      {editing && photo && (
        <button
          type="button"
          className="group-action"
          data-testid="group-photo-remove"
          onClick={() => onRemove?.()}
        >
          Eliminar foto
        </button>
      )}
      {error && (
        <p role="alert" className="group-photo__error" data-testid="group-photo-error">
          {error}
        </p>
      )}
    </section>
  )
}
