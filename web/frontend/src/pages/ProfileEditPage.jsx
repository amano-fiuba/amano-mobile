// Edición del perfil (specs/005-edit-user-profile): formulario precargado con
// los datos frescos del servidor (me(), FR-002), edición de nombre/apellido/
// CBU/CVU y monedas con las reglas de 001 reutilizadas (FR-003..FR-006), correo
// SIEMPRE deshabilitado (FR-007: identidad invariante de la cuenta), avatar
// reemplazable/eliminable (US3) y cancelación sin guardar (FR-008). Guardar
// persiste, aplica los datos frescos (FR-009/FR-012) y vuelve a la
// visualización de 002 con un aviso de éxito one-shot; fallos de red/servidor
// conservan los datos en esta pantalla (FR-019). La actualización vive en el
// contexto de sesión (setUser) para que el resto de la app vea los cambios.
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import {
  UPDATE_NETWORK_ERROR_MESSAGE,
  deleteAvatar,
  me,
  updateAvatar,
  updateProfile,
} from '../api/authClient'
import { prepareImageForUpload } from '../utils/imagePrep'
import { useSnackbar } from '../components/Snackbar'
import TextField from '../components/TextField'
import CurrencySelector from '../components/CurrencySelector'
import { useAuth } from '../auth/AuthContext'
import {
  normalizeCbu,
  trim,
  validateCbu,
  validateFirstName,
  validateLastName,
} from '../validation/registerValidation'
import ApiImage from '../components/ApiImage'



export default function ProfileEditPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const {
    handleSubmit,
    register: bindField,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ mode: 'onBlur' })

  const [loadError, setLoadError] = useState(false)
  const [formError, setFormError] = useState('')
  const showSnackbar = useSnackbar()
  const [currencies, setCurrencies] = useState([])
  const [monedasIniciales, setMonedasIniciales] = useState([])
  const [avatarUrl, setAvatarUrl] = useState('')
  const [hasCustomAvatar, setHasCustomAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarProcesando, setAvatarProcesando] = useState(false)
  // US3 (FR-015/FR-016 enmendadas): el avatar es un cambio PENDIENTE del
  // guardado — ni la subida ni la eliminación contactan al backend al instante
  // (Cancelar puede descartarlas); se aplican al presionar Guardar.
  const [avatarPendiente, setAvatarPendiente] = useState(null)
  const [eliminarPendiente, setEliminarPendiente] = useState(false)
  const [avatarPendienteUrl, setAvatarPendienteUrl] = useState('')

  const aplicarPerfil = (profile) => {
    reset({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      cbuCvu: profile.cbuCvu ?? '',
    })
    const monedas = Array.isArray(profile.currencies) ? profile.currencies : []
    setCurrencies(monedas)
    setMonedasIniciales(monedas)
    setHasCustomAvatar(Boolean(profile.hasCustomAvatar))
    setAvatarUrl(profile.hasCustomAvatar && profile.avatarUrl ? profile.avatarUrl : '')
  }

  // Limpieza del object URL del preview pendiente (descarte/desmonte).
  useEffect(() => {
    return () => {
      if (avatarPendienteUrl) {
        URL.revokeObjectURL(avatarPendienteUrl)
      }
    }
  }, [avatarPendienteUrl])

  // FR-002: precarga fresca del servidor (sin caché), con estados loading/
  // datos/error como en 002. El correo precargado es el del servidor y queda
  // deshabilitado. La estructura (.then/.catch con todos los setState dentro
  // de continuaciones asíncronas) sigue el patrón de ProfilePage (002).
  useEffect(() => {
    let cancelled = false
    me().then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        const profile = result.profile
        setUser(profile)
        aplicarPerfil(profile)
        setAvatarError('')
      } else if (result.network) {
        // FR-019: mensaje, sin datos incompletos ni ficticios.
        setLoadError(true)
      }
      // 401 (sin sesión): el gate de la ruta redirige.
    })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [setUser]) // eslint-disable-line react-hooks/exhaustive-deps


  // FR-011 enmendada: hay modificaciones pendientes si algún campo del form
  // se apartó de la precarga, las monedas difieren de las iniciales (conjunto,
  // no orden) o hay avatar pendiente de subir/eliminar.
  const monedasCambiadas =
    currencies.length !== monedasIniciales.length ||
    monedasIniciales.some((code) => !currencies.includes(code))
  const avatarPendienteCambio = avatarPendiente !== null || eliminarPendiente
  const canSave = isDirty || monedasCambiadas || avatarPendienteCambio

  const onSubmit = async (values) => {
    setFormError('')
    setAvatarError('')
    const result = await updateProfile({
      firstName: trim(values.firstName),
      lastName: trim(values.lastName ?? ''),
      cbuCvu: values.cbuCvu ? normalizeCbu(values.cbuCvu) : '',
      currencies,
    })

    if (!result.ok) {
      const { fields, detail } = result
      const fieldNames = ['firstName', 'lastName', 'cbuCvu']
      if (result.network || result.status >= 500) {
        setFormError(UPDATE_NETWORK_ERROR_MESSAGE)
        return
      }
      if (fields) {
        for (const [field, message] of Object.entries(fields)) {
          if (fieldNames.includes(field)) {
            setError(field, { type: 'server', message })
            continue
          }
          if (field === 'currencies') {
            setFormError(message)
            return
          }
        }
      }
      setFormError(detail || UPDATE_NETWORK_ERROR_MESSAGE)
      return
    }

    // FR-015/FR-016 enmendadas: si hay avatar pendiente, se aplica ahora.
    // Primero la eliminación, luego la subida. Ante fallo del avatar quedan
    // los pendientes y sin navegación (el PUT del perfil ya fue aplicado:
    // idempotente al reintentar — documentado en contracts/users-api.md).
    // IMPORTANTE: deleteAvatar responde 204 SIN cuerpo (sin `profile`); el
    // perfil final se compone con el estado post-DELETE, nunca desde su
    // respuesta (de ahí venía el salto a /login al setUser(undefined)).
    let perfilFinal = result.profile
    if (eliminarPendiente) {
      const eliminacion = await deleteAvatar()
      if (!eliminacion.ok) {
        setAvatarError(eliminacion.fields?.avatar ?? eliminacion.detail ?? UPDATE_NETWORK_ERROR_MESSAGE)
        return
      }
      perfilFinal = { ...perfilFinal, hasCustomAvatar: false, avatarUrl: null }
    }
    if (avatarPendiente) {
      const subida = await updateAvatar(avatarPendiente)
      if (!subida.ok) {
        setAvatarError(subida.fields?.avatar ?? subida.detail ?? UPDATE_NETWORK_ERROR_MESSAGE)
        return
      }
      perfilFinal = subida.profile
    }

    // FR-009 enmendado: persistir, aplicar los datos frescos al contexto de
    // sesión y volver a la visualización de 002; el mensaje de éxito es un
    // snackbar: sobrevive a la navegación y no reaparece al refrescar.
    setUser(perfilFinal)
    aplicarPerfil(perfilFinal)
    if (avatarPendienteUrl) {
      URL.revokeObjectURL(avatarPendienteUrl)
    }
    setAvatarPendiente(null)
    setAvatarPendienteUrl('')
    setEliminarPendiente(false)
    showSnackbar('Los cambios se guardaron correctamente')
    navigate('/profile')
  }

  const subirAvatar = async (event) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = '' // permitir reintentar el mismo archivo
    if (!file) return
    setAvatarError('')
    // Fotos de hasta 25 MB: se achican en el teléfono a un JPG de 2 MB o
    // menos (utils/imagePrep.js). Se retiene pendiente: no hay llamada al
    // backend hasta "Guardar".
    setAvatarProcesando(true)
    const prepared = await prepareImageForUpload(file)
    setAvatarProcesando(false)
    if (!prepared.ok) {
      setAvatarError(prepared.message)
      return
    }
    if (avatarPendienteUrl) {
      URL.revokeObjectURL(avatarPendienteUrl)
    }
    setEliminarPendiente(false) // si había eliminación marcada, la subida la reemplaza
    setAvatarPendiente(prepared.file)
    setAvatarPendienteUrl(URL.createObjectURL(prepared.file))
  }

  const eliminarAvatar = () => {
    if (!hasCustomAvatar || eliminarPendiente) {
      return
    }
    if (avatarPendiente) {
      // Con una subida pendiente, "Eliminar" pasa a significa "no quiero
      // este archivo ni el vigente": descarta la subida y marca la
      // eliminación del vigente (se confirma con Guardar).
      if (avatarPendienteUrl) {
        URL.revokeObjectURL(avatarPendienteUrl)
      }
      setAvatarPendiente(null)
      setAvatarPendienteUrl('')
    }
    setAvatarError('')
    setEliminarPendiente(true)
  }

  if (loadError) {
    return (
      <main className="page">
        <h1>Modificar perfil</h1>
        <p role="alert">No se pudo cargar el perfil. Intenta nuevamente</p>
      </main>
    )
  }

  const previewUrl = avatarPendiente
    ? avatarPendienteUrl
    : eliminarPendiente
      ? '/avatar-default.png'
      : avatarUrl || '/avatar-default.png'
  const rules = (validate) => ({
    validate: (value) => {
      const message = validate(value)
      return message === '' || message
    },
  })

  return (
    <main className="page">
      <h1>Modificar perfil</h1>
      {formError && (
        <p role="alert" data-testid="form-error">
          {formError}
        </p>
      )}

      {/* US3: avatar procesado independiente de los datos del formulario. */}
      <ApiImage
        src={previewUrl}
        alt={`Avatar de ${user?.firstName ?? 'usuario'}`}
        className="app-avatar"
        width={96}
        height={96}
      />
      <div className="avatar-actions">
        <label htmlFor="avatar-edit">
          Avatar: <input
            id="avatar-edit"
            type="file"
            accept="image/*"
            onChange={subirAvatar}
          />
        </label>
        {hasCustomAvatar && (
          <button type="button" onClick={eliminarAvatar} disabled={eliminarPendiente}>
            Eliminar avatar
          </button>
        )}
      </div>
      {avatarProcesando && <p aria-live="polite">Preparando la foto…</p>}
      {avatarError && (
        <p role="alert" data-testid="avatar-error">
          {avatarError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* FR-007: el correo es la identidad de la cuenta; solo lectura. */}
        <div className="field">
          <label htmlFor="email-readonly">Correo electrónico</label>
          <input
            id="email-readonly"
            value={user?.email ?? ''}
            readOnly
            disabled
            aria-describedby="email-readonly-note"
          />
          <p id="email-readonly-note">El correo electrónico no puede modificarse</p>
        </div>

        <TextField
          label="Nombre"
          error={errors.firstName?.message}
          {...bindField('firstName', {
            required: 'El nombre es obligatorio',
            ...rules(validateFirstName),
          })}
        />

        <TextField
          label="Apellido"
          error={errors.lastName?.message}
          {...bindField('lastName', rules(validateLastName))}
        />

        <TextField
          label="CBU/CVU"
          error={errors.cbuCvu?.message}
          {...bindField('cbuCvu', rules(validateCbu))}
        />

        <CurrencySelector
          value={currencies}
          onChange={setCurrencies}
          legend="Monedas preferidas (opcional; vacío = ARS por defecto)"
        />

        {/* Cancelar a la izquierda y Guardar a la derecha. FR-011 enmendada:
            Guardar solo cuando hay cambios pendientes; siempre deshabilitado
            durante el envío. */}
        <div className="form-actions form-actions--split">
          {/* Vuelve a la visualización de 002 sin guardar nada (FR-008);
              siempre habilitado y descarta avatar pendiente. */}
          <button
            type="button"
            onClick={() => {
              if (avatarPendienteUrl) {
                URL.revokeObjectURL(avatarPendienteUrl)
              }
              setAvatarPendiente(null)
              setAvatarPendienteUrl('')
              setEliminarPendiente(false)
              navigate('/profile')
            }}
          >
            Cancelar
          </button>
          <button type="submit" disabled={!canSave || isSubmitting}>
            Guardar
          </button>
        </div>
      </form>

      <p>
        <Link to="/profile/password">Cambiar contraseña</Link>
      </p>
    </main>
  )
}
