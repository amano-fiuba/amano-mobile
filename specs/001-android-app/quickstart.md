# Quickstart: correr A mano en tu celular Android

**Feature**: `001-android-app`

Guía paso a paso. La primera vez lleva unos 20-30 minutos (casi todo es descargar Android Studio). Después, actualizar la app es un solo comando.

## 1. Qué necesitás

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js / npm | 24 (la de first-steps; mínimo 22) | compilar la web y correr Capacitor |
| Android Studio | Otter 2025.2.1 o posterior | SDK de Android y emulador |
| JDK | 21 (`openjdk-21-jdk`), además del 25 del backend | Gradle de Android no compila con Java 25 |
| Teléfono Android | 7.0 o superior | correr la app |
| Cable USB | de datos (no solo de carga) | instalar la app |

Al abrir Android Studio por primera vez, aceptá el asistente: instala el Android SDK. Después, en *Settings → Languages & Frameworks → Android SDK*, confirmá que esté instalado **Android 16 (API 36)**.

Para que la terminal encuentre `adb`, agregá el SDK al `PATH` (Fedora/Linux, en `~/.bashrc`):

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```

En Windows el SDK suele estar en `%LOCALAPPDATA%\Android\Sdk`; en macOS, en `~/Library/Android/sdk`.

## 2. Preparar el teléfono

1. *Ajustes → Acerca del teléfono* → tocá **Número de compilación** 7 veces hasta que diga "Ya sos desarrollador".
2. *Ajustes → Sistema → Opciones de desarrollador* → activá **Depuración por USB**.
3. Conectá el teléfono por USB y aceptá el cartel "¿Permitir depuración USB?".
4. Comprobá que se vea:

```bash
adb devices
# List of devices attached
# R58N12345AB    device
```

Si dice `unauthorized`, desbloqueá el teléfono y aceptá el cartel.

## 2-bis. Sin teléfono: emulador de Android Studio

Si no tenés un celular a mano, el emulador sirve para todo el checklist de §5.

1. Android Studio → *Device Manager* → **+** → *Create Virtual Device*.
2. Elegí **Pixel 8** → imagen de sistema **API 36** (descarga ~1,5 GB) → *Finish*.
3. Iniciá el emulador con ▶ y esperá a que muestre la pantalla de inicio.
4. Seguí con §3: `npm run android` lo lista como `emulator-5554`.

Requisitos: virtualización activada en el BIOS (VT-x / AMD-V) y 8 GB de RAM o más. En Fedora/Linux, tu usuario tiene que estar en el grupo `kvm` (`sudo usermod -aG kvm $USER` y reiniciar la sesión).

Notas:
- Backend local: `adb reverse tcp:8081 tcp:8081` funciona igual con el emulador (§4).
- Para probar subidas de imágenes, arrastrá una foto de tu computadora a la ventana del emulador: queda en *Descargas* y aparece en el selector.
- Los enlaces de los correos abrilos en el navegador de tu computadora; después iniciá sesión en el emulador.

## 3. Primera instalación

Desde la raíz del repositorio:

```bash
cd frontend
npm install
cd ../mobile
npm install
npm run setup:android     # compila la web en modo android, genera android/ y sincroniza
npm run android           # elige el teléfono conectado, compila e instala
```

`npm run android` muestra la lista de dispositivos; elegí tu teléfono con las flechas y Enter. La app "A mano" queda instalada y se abre sola.

**Alternativa con Android Studio**: `npm run open` abre el proyecto; elegí tu teléfono arriba y tocá ▶ **Run**. La primera compilación de Gradle tarda varios minutos.

**Solo el APK** (para pasarlo a otro teléfono): en Android Studio, *Build → Build App Bundle(s) / APK(s) → Build APK(s)*. Queda en `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. En el otro teléfono hay que permitir "instalar apps desconocidas".

Después de `setup:android`, versioná la carpeta `mobile/android/` y el `mobile/package-lock.json` (tarea T013).

## 4. ¿Contra qué backend habla la app?

Por defecto, contra **producción** (`frontend/.env.android`):

```
VITE_API_BASE_URL=https://amano-fiuba.duckdns.org
```

Necesitás que el backend de producción esté arriba y tener una cuenta verificada ahí.

> **Importante (FR-019)**: la app trae las pantallas de la rama con que la compilaste. Si producción todavía no tiene ese código, las pantallas nuevas (por ejemplo recordatorios o gastos recurrentes de grupo) van a dar error. En ese caso probá contra tu backend local.

### Usar tu backend local (desarrollo)

1. Levantá el stack completo como dice first-steps §9: `docker compose up -d --build` (queda en `http://localhost:8081`).
2. Creá `frontend/.env.android.local` (git lo ignora):

   ```
   VITE_API_BASE_URL=http://localhost:8081
   ```

3. Hacé que el `localhost:8081` del teléfono sea el de tu computadora (repetilo cada vez que reconectes el cable):

   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

4. `npm run android` desde `mobile/`.

HTTP sin TLS funciona solo en builds de depuración (`android/app/src/debug/AndroidManifest.xml`); el build de release exige HTTPS.

Para volver a producción, borrá `.env.android.local` y volvé a correr `npm run android`.

## 5. Verificación en el dispositivo (SC-001)

Recorré esta lista con una cuenta verificada. Cada punto corresponde a una feature existente:

- [ ] **web-001** Registrarse con avatar (subida multipart) → "Revisa tu correo".
- [ ] **web-003** Abrir el enlace del correo (se abre en el navegador) y verificar; volver a la app.
- [ ] **web-004** Iniciar sesión → entra a la pantalla principal.
- [ ] **US2** Cerrar la app desde recientes, abrirla → sigue la sesión.
- [ ] **web-002/web-005** "Mi perfil": ver, editar datos, cambiar avatar desde la galería, cambiar contraseña.
- [ ] **web-006** "¿Olvidaste tu contraseña?" envía el correo.
- [ ] **web-007** Registrar un gasto (único y recurrente).
- [ ] **web-009** "Gastos recurrentes": pausar, reanudar, finalizar.
- [ ] **web-008/web-011** Buscar un usuario y enviarle solicitud.
- [ ] **web-012/web-013** "Amigos": aceptar una solicitud y verla en "Mis amigos".
- [ ] **web-010** Crear grupo, agregar miembro, foto del grupo (multipart), descripción, permisos, roles, salir/quitar.
- [ ] **web-014** Historial del grupo con filtros.
- [ ] **US3** Atrás vuelve a la pantalla anterior; en la primera, cierra la app.
- [ ] **US3** La barra de navegación no queda tapada por la barra de estado.
- [ ] **US3** El enlace a GitHub de la portada abre el navegador.
- [ ] **US2** "Cerrar sesión" → `/profile` redirige al acceso.
- [ ] **web-015** Pantalla principal: resumen de perfil, grupos recientes, actividad personal y solicitudes pendientes.
- [ ] **web-015** Barra superior: buscador global, notificaciones, preguntas frecuentes y ajustes.
- [ ] **web-015** Botón "+" de acciones rápidas: no queda tapado por la barra de gestos.
- [ ] **web-016** Eliminar un amigo.
- [ ] **web-017/web-022** Estados de deuda y gestión de deudas del grupo.
- [ ] **web-018** Registrar un pago y validarlo.
- [ ] **web-020** Salir de un grupo.
- [ ] **web-025** Configurar recordatorios de deudas del grupo.
- [ ] **web-027** Cargar un gasto con los distintos modos (moneda, con amigo, en grupo).
- [ ] **web-028** Gastos recurrentes de grupo y fechas de vencimiento.
- [ ] **FR-017** Se ven las fotos en todas las pantallas (buscador, notificaciones, amigos, diálogos, miembros): tu avatar (barra, inicio, perfil), los avatares de los miembros y las fotos de grupo.
- [ ] **web-029** Finalizar un recurrente de grupo y ver el origen de un gasto generado.
- [ ] **web-030** "Silbar" una deuda vencida.
- [ ] **web-031** Buscar en la actividad personal (texto, mes, año; "Filtros" en la app).
- [ ] **web-032/web-034** Estadísticas: pestañas Balance, Ingresos y Gastos; cambiar mes y año.
- [ ] **web-033** Registrar un ingreso desde el "+" y verlo en Actividad → Ingresos.
- [ ] **002** Barra inferior, pestañas, pasos del gasto grupal y foto pesada: checklist de [002 tasks](../002-diseno-movil-y-notificaciones/tasks.md).
- [ ] Modo avión: la app abre y muestra los mensajes de error de red.

Si **el login funciona pero la sesión se pierde** o **fallan las subidas de imágenes**, ver research.md D2 (plan B).

## 6. Actualizar la app cada semana (US4)

```bash
cd mobile
npm run android
```

Eso recompila el frontend, copia el resultado a la app y la reinstala. No hace falta desinstalar: la sesión se conserva.

Regla para el equipo: toda llamada nueva a la API usa `fetch(apiUrl('/api/...'))` (importando de `src/api/apiBase.js`). Si alguien escribe `fetch('/api/...')`, `npm test` falla y dice en qué archivo.

## 7. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `adb: command not found` | Falta el `PATH` del paso 1 |
| El teléfono no aparece en `npm run android` | Revisar `adb devices`; cable de datos; aceptar el cartel de depuración |
| `SDK location not found` | Abrir una vez `mobile/android` en Android Studio, o crear `mobile/android/local.properties` con `sdk.dir=/ruta/al/Sdk` |
| Error de red en todas las pantallas | El backend configurado no responde; con backend local, repetir `adb reverse tcp:8081 tcp:8081` |
| `Falta frontend/dist-android` | Correr `npm run build:web` en `mobile/` (o `npm install` en `frontend/` primero) |
| `Unsupported class file major version 69` | Gradle 8.14 no soporta Java 25 (el del backend, y también el que trae Android Studio 2026). Instalar Java 21 (`sudo apt install openjdk-21-jdk`), `pkill -f GradleDaemon` y compilar con `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm run android` |
| El backend local no arranca: `Validate failed: Migrations have failed validation` | La base local tiene migraciones de otra rama con los mismos números. Borrar la base local (se pierden los datos de prueba): `docker compose down -v` y `docker compose up -d --build` |
| Cambié el frontend y la app no cambia | Usar `npm run android` (no solo Run en Android Studio, que no recompila la web) |
