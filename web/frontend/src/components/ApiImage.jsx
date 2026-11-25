import { useEffect, useState } from 'react'
import { loadApiImage, needsNativeLoad } from '../api/apiImage'

const DEFAULT_AVATAR = '/avatar-default.png'

/**
 * <img> para imágenes servidas por la API (avatares y fotos de grupo;
 * amano-mobile specs/001-android-app, FR-017). En la web dibuja el mismo <img src>. En la
 * app carga la imagen por la capa nativa y, mientras tanto o si falla,
 * muestra el avatar por defecto.
 */
export default function ApiImage({ src, fallback = DEFAULT_AVATAR, ...props }) {
  const native = needsNativeLoad(src)
  const [loaded, setLoaded] = useState({ src: null, url: null })

  useEffect(() => {
    if (!native) return undefined
    let active = true
    loadApiImage(src)
      .then((url) => active && setLoaded({ src, url }))
      .catch(() => active && setLoaded({ src, url: fallback }))
    return () => {
      active = false
    }
  }, [native, src, fallback])

  if (!native) {
    return <img src={src || fallback} {...props} />
  }
  return <img src={loaded.src === src && loaded.url ? loaded.url : fallback} {...props} />
}
