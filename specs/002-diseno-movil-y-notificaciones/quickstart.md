# Quickstart: 002 — app Android con notificaciones

Guía de instalación de la app: [001 quickstart](../001-android-app/quickstart.md) (§1 a §3: Node, Android Studio, depuración USB, `adb devices`). Acá van los pasos nuevos.

## 1. Compilar e instalar

```bash
cd frontend && npm install
cd ../mobile && npm install
npm run android        # compila, prepara android/, sincroniza e instala en el celu
npm run apk            # genera android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run sync` y `npm run android` aplican solos los cambios nativos (ícono, manifiesto, Firebase): no hace falta borrar `android/`.

## 2. Configurar Firebase (una vez por equipo)

1. Entrá a <https://console.firebase.google.com> con una cuenta de Google del equipo → **Agregar proyecto** → nombre `amano` → podés desactivar Google Analytics → **Crear**.
2. En el proyecto: **Agregar app → Android**. Nombre del paquete: `com.amano.app` (tiene que ser exacto). Apodo: `A mano`. **Registrar app**.
3. **Descargá `google-services.json`** y guardalo en `mobile/google-services.json`.
4. **Cuenta de servicio para el servidor**: ⚙️ **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Se descarga un JSON (por ejemplo `amano-firebase.json`). **Es secreto**: no lo subas al repo ni lo mandes por grupos.
5. Pasalo a base64 en una línea y ponelo en el `.env` del servidor (Raspberry) y, si querés probar en local, en tu `.env`:
   ```bash
   base64 -w0 amano-firebase.json      # en Mac: base64 -i amano-firebase.json
   ```
   ```
   FIREBASE_CREDENTIALS_BASE64=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIs...
   ```
6. Reiniciá el backend (`docker compose up -d`). En los logs tiene que aparecer `Push enabled through Firebase project amano-…`.
7. Volvé a compilar la app (`npm run android` / `npm run apk`): al compilar dice `Notificaciones: activadas`.

Sin el paso 3 la app funciona pero no pide permiso de notificaciones. Sin el paso 5 el backend funciona pero no envía nada.

## 3. Probar las notificaciones

1. En el celu, iniciá sesión con la cuenta A y aceptá "¿Permitir notificaciones?".
2. Cerrá la app (o dejala en segundo plano).
3. Desde la web, con la cuenta B, enviale una solicitud de amistad a A.
4. En el celu aparece **Nueva solicitud de amistad — B te envió una solicitud de amistad**. Tocala: se abre Amigos.
5. Con la app abierta, repetí desde otra cuenta: aparece un aviso abajo y la campanita suma una.
6. Cerrá sesión en el celu y enviá otra solicitud a A: no llega nada.

Si no llega:
- `docker compose logs backend | grep -i push` → ¿dice `Push enabled`? ¿Aparece `Firebase answered 4xx`? Un `403` suele ser la API apagada: en Google Cloud Console del proyecto, habilitá **Firebase Cloud Messaging API**.
- Ajustes del teléfono → Apps → A mano → Notificaciones: ¿están activadas?
- En `chrome://inspect` (con el celu conectado) → Console: errores de `registration`.
- En la base: `SELECT user_id, platform, last_seen_at FROM push_devices;` debería tener una fila de tu cuenta.

## 4. Checklist en el dispositivo

Ver [tasks.md](./tasks.md#checklist-en-el-dispositivo).
