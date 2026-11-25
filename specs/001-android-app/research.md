# Research: Aplicación móvil para Android

**Feature**: `001-android-app` | **Date**: 2026-11-05

Cada decisión indica qué se eligió, por qué y qué alternativas se descartaron.

## D1. Empaquetar el frontend existente con Capacitor

**Decisión**: La app Android es el frontend React actual empaquetado con Capacitor 8 en un módulo nuevo `mobile/`.

**Rationale**: La SPA ya cubre web-001 a web-014 con pruebas y cobertura ≥ 85 %. Empaquetarla da el 100 % de las funciones sin duplicar reglas (constitución I, VI y X) y hace que cada sprint llegue a la app recompilando (US4). Capacitor no exige cambios de arquitectura en el frontend: corre la misma SPA en el WebView del sistema y agrega la capa nativa.

**Alternativas descartadas**:
- *Reescritura en React Native o Kotlin*: duplica 14 features, sus validaciones y sus pruebas; cada semana habría que implementar todo dos veces.
- *PWA instalable*: no produce una app Android instalable desde Android Studio y depende del navegador para la sesión; no cumple "aplicación mobile".
- *Apache Cordova*: predecesor de Capacitor con menor mantenimiento.

## D2. Pantallas dentro del APK; solo la API es remota

**Decisión**: El build de la SPA se copia dentro de la app (`webDir`). La app no carga el sitio publicado.

**Rationale**: La app abre sin red, no depende de que el despliegue web esté al día y es una app real, no un acceso directo.

**Alternativa (plan B documentado)**: `server.url` apuntando al sitio publicado. Cero cambios en el frontend y la cookie funciona como en el navegador (mismo origen), pero la app queda atada al despliegue y no abre sin red. Si en la verificación en dispositivo (tasks T020-T022) la sesión por cookie fallara, este cambio de una línea en `capacitor.config.json` es la salida y debe registrarse aquí.

## D3. URL base de la API configurable en tiempo de compilación

**Decisión**: Nuevo módulo `frontend/src/api/apiBase.js` con `apiUrl(path)`. Lee `VITE_API_BASE_URL`; vacío en la web, la URL del backend en el build Android (`frontend/.env.android`, modo `android` de Vite, salida `dist-android/`). Todas las llamadas `fetch` pasan por `apiUrl`.

**Rationale**: Dentro de la app la SPA se sirve desde `https://localhost`, así que `/api/...` relativo no llega al backend. Con base vacía la URL resultante es idéntica a la actual, por lo que la web y sus pruebas no cambian (FR-004). Es el mecanismo estándar de Vite para variables de entorno; no agrega dependencias.

**Guardia**: `apiBase.test.js` lee todo el código fuente y falla si algún `fetch` recibe un literal `/api...` (FR-006), para que las features de las próximas semanas no rompan la app sin que nadie lo note.

**Alternativas descartadas**: interceptar `window.fetch` globalmente (magia difícil de seguir); reescribir URLs en la capa nativa (acopla la app a rutas del backend).

## D4. HTTP nativo para conservar la cookie de sesión

**Decisión**: Se habilitan los plugins incluidos en Capacitor `CapacitorHttp` y `CapacitorCookies`. Con ellos, `fetch` se ejecuta con la pila HTTP de Android y las cookies se guardan en el almacén nativo.

**Rationale**: La sesión es la cookie `amano_auth` HttpOnly y `SameSite=Strict`. Desde `https://localhost` hacia el backend, el WebView la trataría como cookie de terceros y además el backend no habilita CORS. Con HTTP nativo no aplican CORS ni SameSite, la cookie HttpOnly se guarda y se reenvía sola, y no hay que tocar `SecurityConfig` ni crear un mecanismo de autenticación nuevo (constitución IX, FR-007).

**Alternativas descartadas**: habilitar CORS y `SameSite=None` en el backend (cambia la política de seguridad de la web, fuera de alcance); token en `Authorization` (mecanismo nuevo no acordado).

**Riesgo**: las subidas multipart (`FormData` con archivos) dependen del soporte de `CapacitorHttp`, presente desde Capacitor 5. Se verifican en dispositivo (quickstart §5). Si fallan, aplicar el plan B de D2.

## D5. Módulo separado `mobile/`

**Decisión**: `mobile/` contiene `package.json`, `capacitor.config.json`, el script de preparación y, una vez generado, el proyecto nativo `android/`. El frontend no suma dependencias.

**Rationale**: Mantiene el monorepo ordenado como `backend/` y `frontend/` (constitución I). La imagen Docker y el CI del frontend no cambian (FR-016).

## D6. Botón Atrás con el plugin oficial `@capacitor/app`

**Decisión**: Se instala `@capacitor/app` en `mobile/` sin registrar listeners.

**Rationale**: Sin el plugin, Atrás cierra la app desde cualquier pantalla. Con el plugin y sin listeners, Capacitor navega el historial del WebView y cierra la app en la primera pantalla (FR-011). No requiere código en el frontend.

## D7. Zonas seguras por CSS

**Decisión**: `SystemBars` con `insetsHandling: "css"` (valor por defecto de Capacitor 8) inyecta `--safe-area-inset-*`. `index.scss` suma esos valores al relleno de `body` y de la barra de navegación, con `env(safe-area-inset-*)` y `0px` como respaldo. Se agrega `viewport-fit=cover` al `viewport`.

**Rationale**: Capacitor 8 dibuja de borde a borde. En la web las variables no existen y el relleno es 0 (FR-010).

## D8. Enlaces de correo: fuera de alcance

**Decisión**: Los enlaces de verificación y de restablecimiento siguen apuntando a `APP_BASE_URL` (la web).

**Rationale**: Abrirlos en la app exige App Links (archivo `assetlinks.json` en el dominio, firma conocida y cambios en Caddy), lo que excede la historia. La web ya resuelve esos flujos.

**Decisión pendiente para el equipo**: si se quieren App Links, especificarlo como historia propia.

## D9. Servidor de destino: producción por HTTPS, local solo en debug

**Decisión**: `frontend/.env.android` apunta a `https://amano-fiuba.duckdns.org`. Para desarrollo se crea `frontend/.env.android.local` (ignorado por git) con `http://localhost:8081` y se usa `adb reverse tcp:8081 tcp:8081`, que hace que `localhost:8081` del teléfono sea el del compose del equipo. El HTTP sin TLS se habilita solo en `android/app/src/debug/AndroidManifest.xml` (lo copia `npm run setup:android`).

**Rationale**: `compose.yaml` publica el frontend solo en `127.0.0.1`, así que el teléfono no lo ve por Wi-Fi; `adb reverse` lo resuelve por USB sin tocar el compose (FR-016). Limitar HTTP al build de depuración cumple FR-014.

**Pendiente de confirmar**: que el dominio de producción sea el de `.env.example`.

## D10. Versiones

**Decisión**: Capacitor 8 (`^8.0.0`): Node ≥ 22, Android Studio Otter 2025.2.1+, `minSdk` 24, `targetSdk` 36. El `package-lock.json` de `mobile/` se genera con el primer `npm install` y se versiona.

## D12. Imágenes protegidas cargadas por la capa nativa (actualización sprint-4)

**Problema** (presente desde la primera versión): avatares y fotos de grupo son `<img src="/api/...">` protegidos por la cookie. En la app, el WebView pide la imagen a `https://localhost/api/...` (no existe) y, aunque se le antepusiera la base, el pedido no pasaría por `CapacitorHttp` y la cookie `SameSite=Strict` no viajaría desde otro sitio.

**Decisión** (elegida por el equipo frente al plan B de D2): componente `ApiImage` (`frontend/src/components/ApiImage.jsx`) que reemplaza a `<img>` solo en las imágenes servidas por la API. En la web dibuja el mismo `<img src>`. En la app, si `src` empieza con `/api/`, pide la imagen con `Capacitor.nativePromise('CapacitorHttp', 'request', { responseType: 'blob' })` —la misma capa nativa y la misma cookie que el resto de las llamadas— y usa la respuesta base64 como `data:` URL. Mientras carga o si falla, muestra `/avatar-default.png`.

**Rationale**: el `fetch` parcheado de Capacitor no garantiza respuestas binarias (issue ionic-team/capacitor#7445); pedir `responseType: 'blob'` a la capa nativa devuelve base64 de forma documentada. El frontend no suma dependencias: usa el puente que inyecta la app (`window.Capacitor`), que en la web no existe.

**Guardia** (2026-11-10): al actualizar a `feat/recurrence-due-dates` aparecieron 18 `<img>` con avatares nuevos (buscador global, notificaciones, diálogos de amigos y grupos, chips de personas). `ApiImage.test.jsx` ahora inspecciona el código y falla ante cualquier `<img src={...}>` dinámico (FR-018); los archivos estáticos (`src="/logo.png"`) quedan permitidos.

**Riesgo**: no verificable fuera de un dispositivo. Si falla, las pantallas siguen funcionando con el avatar por defecto; la alternativa es el plan B de D2.

## D13. Compatibilidad entre la app y el backend

**Decisión**: el APK empaqueta el frontend de la rama con que se compila; debe probarse contra un backend de esa misma rama. Mientras producción no tenga esas features, se prueba con el backend local (quickstart §4). Para compartir el APK con otras personas, producción tiene que estar desplegada con el mismo código.

**Rationale**: las pantallas nuevas llaman endpoints nuevos (por ejemplo `/api/groups/{id}/reminder-settings`, `/api/groups/{id}/recurring-expenses`); contra un backend viejo responden 404/5xx.

## D11. CI

**Decisión**: Esta historia no agrega un job de Android al CI. Los cambios del frontend siguen cubiertos por el job existente. **Mejora pendiente** (constitución XI): job que ejecute `npm run build:android` y `./gradlew assembleDebug`.
