import { useState } from 'react'
import { prepareImageForUpload } from '../utils/imagePrep'

// US3 optional avatar uploader (task T036; FR-003, FR-010, FR-013, FR-022, D6):
// live validation with Spanish messages — size first, then the REAL content is
// inspected via magic bytes (the declared MIME is a hint, never the truth).
// Without a file the field stays clean and never blocks the rest of the form.
// Photos are shrunk on the device before upload (utils/imagePrep.js, mobile 002).

export default function AvatarUploader({ onFileSelected }) {
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  const handleChange = async (event) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setError('')
      setFileName('')
      onFileSelected?.(null)
      return
    }

    // Fotos de hasta 25 MB: se achican en el teléfono antes de subirlas
    // (utils/imagePrep.js); el backend sigue recibiendo JPG/PNG de hasta 2 MB.
    const prepared = await prepareImageForUpload(file)
    if (!prepared.ok) {
      setError(prepared.message)
      // only resets an earlier valid selection (invalid picks deliver nothing)
      if (fileName) {
        onFileSelected?.(null)
      }
      return
    }

    setError('')
    setFileName(file.name)
    onFileSelected?.(prepared.file)
  }

  const handleClear = () => {
    setError('')
    setFileName('')
    onFileSelected?.(null)
  }

  return (
    <div>
      <label>
        Avatar{' '}
        <input
          type="file"
          /* Cualquier foto: se convierte a JPG antes de subirla (imagePrep). */
          accept="image/*"
          onChange={handleChange}
        />
      </label>
      {fileName && !error && (
        <button type="button" onClick={handleClear}>
          Quitar
        </button>
      )}
      {fileName && !error && <p>Selección: {fileName}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
