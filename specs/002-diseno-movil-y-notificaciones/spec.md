# Feature Specification: App Android completa — diseño móvil, fotos pesadas y notificaciones en el celular

> **Numeración en este repositorio (amano-mobile)**: `001` y `002` son las specs de la app móvil. Las referencias `web-NNN` son las specs del repositorio de la aplicación web (`amano`), por ejemplo `web-015` = `015-main-screen`. Esta spec se escribió originalmente como `035-android-app` del repositorio web; las rutas de archivos (`frontend/`, `backend/`, `mobile/`) son las de ese monorepo, donde está implementada.

**Feature Branch**: `feat/android-app`

**Created**: 2026-11-18 · **Updated**: 2026-11-22

**Status**: Implementado (pendiente de verificación en dispositivo)

**Input**: "Actualizar la app mobile con todo lo del sprint 5. No quiero que sea una adaptación uno a uno: que la mobile no tenga páginas kilométricas de scroll sino páginas accesibles desde un celular. ¿Se puede hacer que la foto de perfil acepte imágenes más pesadas?" — y, sobre `main`: "Una spec nueva con número 35 que hable de todos los cambios de la aplicación, y agregar notificaciones en el celular cuando te llega una notificación en la aplicación."

## Contexto y relación con otras specs

- **001 (app Android)** se diseñó e implementó en una rama que nunca llegó a `main`. Esta spec la **reaplica completa** sobre `main` (web-001 a web-034) y la extiende. La especificación original de 001 sigue vigente como referencia; donde haya diferencias, manda 002.
- **web-015 (pantalla principal)** define la campanita: hoy sus notificaciones son las **solicitudes de amistad pendientes**. 002 lleva esas notificaciones al celular.
- **web-001 / web-005 / web-010** definen el avatar y la foto de grupo con un máximo de 2 MB en el backend. 002 no cambia ese límite: la foto se achica en el teléfono.
- La **web no cambia** salvo el envío de fotos pesadas (US3), que también aplica en el navegador.

## Clarifications

### Session 2026-11-18

- Q: ¿El diseño móvil cambia también la web vista desde un celular? → A: No. Solo aplica en la app (build `android` o dentro de Capacitor). Para probarlo en el navegador: cualquier ruta con `?mobile=1` (`?mobile=0` lo apaga).
- Q: ¿Cómo se evita el scroll largo? → A: Pestañas en las pantallas con varias secciones independientes, pasos en los formularios largos y barra de navegación inferior.
- Q: ¿Foto más pesada subiendo el límite del servidor o achicándola? → A: Achicándola en el teléfono: hasta 25 MB de entrada, JPG de 1280 px y ≤ 2 MB de salida. Sin cambios en backend ni base.

### Session 2026-11-22

- Q: ¿Qué notificaciones llegan al celular? → A: Las mismas que muestra la campanita: **solicitudes de amistad recibidas**. El mecanismo es genérico para sumar otros avisos (silbatos de web-030, recordatorios de web-025) en features futuras.
- Q: ¿Con qué servicio? → A: Firebase Cloud Messaging (gratuito, el estándar de Android). El backend llama a la API HTTP v1 de FCM con lo que ya tiene el proyecto (RestClient y jjwt), sin el SDK de Firebase.
- Q: ¿Qué pasa si el servidor no tiene credenciales de Firebase? → A: Todo funciona igual y no se envían notificaciones. Lo mismo en la app si se compiló sin `google-services.json`: no pide permiso.
- Q: ¿Y si dos cuentas usan el mismo teléfono? → A: El teléfono recibe solo las de la cuenta con sesión: al iniciar sesión el token pasa a esa cuenta y al cerrar sesión se borra.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La app trae todo lo de la web (Priority: P1)

Todo lo que existe en la web en `main` (registro, perfil, gastos personales y recurrentes, amigos, grupos, deudas, pagos, recordatorios, recurrentes de grupo, silbato, buscador de actividad, ingresos, estadísticas) funciona en la app Android, con las fotos visibles.

**Acceptance Scenarios**:

1. **Given** la app instalada, **When** se recorre el checklist de [quickstart.md](./quickstart.md) §4, **Then** cada ítem funciona igual que en la web.
2. **Given** una pantalla nueva que llama a la API sin `apiUrl` o muestra una imagen de la API con `<img>`, **When** corren las pruebas, **Then** fallan nombrando el archivo.

### User Story 2 - Pantallas pensadas para el celular (Priority: P1)

| Pantalla | Fijo arriba | En el celular |
|---|---|---|
| Navegación | Logo, buscador, campanita | Barra inferior: Inicio · Grupos · "+" · Actividad · Más |
| Inicio | Balance del mes | Pestañas Grupos · Actividad · Solicitudes |
| Grupo | Nombre, foto y acciones | Pestañas Gastos · Miembros · Actividad |
| Amigos | Título | Pestañas Amigos · Solicitudes (con contador) |
| Estadísticas | Mes y año | Pestañas Balance · Ingresos · Gastos |
| Actividad personal | Balance compacto | Mes y año plegados en "Filtros" |
| Nuevo gasto grupal | Título | Pasos 1 Datos → 2 Reparto, botones fijos abajo |
| Portada sin sesión | — | Bienvenida de una pantalla |

**Acceptance Scenarios**:

1. **Given** una pantalla principal, **Then** se ve la barra inferior con la sección activa; en formularios y detalles se oculta.
2. **Given** una pantalla con pestañas, **When** se toca otra pestaña o se desliza en horizontal, **Then** cambia de sección sin recargar ni perder lo escrito, y la elección se recuerda al volver.
3. **Given** el paso 1 del gasto grupal con datos inválidos, **When** se toca "Siguiente: reparto", **Then** se ven los errores y no avanza; si al guardar hay errores del paso 1, vuelve a ese paso.
4. **Given** la web en una computadora, **Then** se ve igual que antes de 002.

### User Story 3 - Fotos pesadas (Priority: P1)

**Acceptance Scenarios**:

1. **Given** una foto de 3 a 25 MB, **When** se elige como avatar (registro o edición) o foto de grupo, **Then** se acepta, se ve la vista previa y se sube un JPG ≤ 2 MB y ≤ 1280 px, con la orientación de la cámara.
2. **Given** un JPG o PNG ≤ 2 MB, **Then** se sube tal cual.
3. **Given** más de 25 MB, **Then** "La imagen es demasiado grande (máximo 25 MB)".
4. **Given** un archivo que no es imagen, **Then** "El archivo debe ser una imagen JPG o PNG válida".

### User Story 4 - Notificaciones en el celular (Priority: P1)

Cuando alguien le envía una solicitud de amistad a una persona, su celular muestra una notificación aunque la app esté cerrada. Al tocarla se abre la app en Amigos.

**Independent Test**: Con la app instalada en el teléfono A (cuenta Ana) y la web abierta con la cuenta Bruno, Bruno le envía una solicitud a Ana: en menos de 10 segundos el teléfono A muestra "Nueva solicitud de amistad — Bruno … te envió una solicitud de amistad".

**Acceptance Scenarios**:

1. **Given** la primera vez que se inicia sesión en la app (Android 13+), **Then** el teléfono pregunta si permite notificaciones; si se acepta, el teléfono queda registrado para esa cuenta.
2. **Given** permiso concedido y la app cerrada o en segundo plano, **When** la cuenta recibe una solicitud de amistad, **Then** aparece la notificación con el ícono de A mano; al tocarla se abre Amigos.
3. **Given** la app abierta, **When** llega una solicitud, **Then** se muestra un aviso dentro de la app y la campanita se actualiza.
4. **Given** permiso denegado, **Then** la app funciona igual y no vuelve a insistir (se puede activar desde los ajustes del teléfono).
5. **Given** se cierra sesión en el teléfono, **Then** ese teléfono deja de recibir notificaciones de esa cuenta.
6. **Given** otra cuenta inicia sesión en el mismo teléfono, **Then** las notificaciones son solo de la nueva cuenta.
7. **Given** la app se desinstaló, **When** el servidor intenta notificar, **Then** borra ese teléfono de la lista.
8. **Given** el servidor sin credenciales de Firebase o la app sin `google-services.json`, **Then** todo funciona igual sin notificaciones.

### Edge Cases

- Varias solicitudes del mismo remitente no se apilan: cada notificación lleva un `tag` por solicitud.
- Si Firebase está caído, la solicitud se crea igual (el envío es asíncrono y después del commit) y no se reintenta.
- Una notificación cuya ruta no sea interna (`/…`) se ignora al tocarla.

## Requirements *(mandatory)*

### App y diseño móvil (US1, US2)

- **FR-001**: Todas las llamadas a la API MUST pasar por `apiUrl()` y todas las imágenes de la API por `ApiImage`; pruebas de guardia lo verifican.
- **FR-002**: El diseño móvil MUST activarse solo en la app (o con `?mobile=1`) y MUST NOT cambiar el HTML ni los estilos de la web.
- **FR-003**: Las pantallas de la tabla de US2 MUST mostrar una sección por vez, con todas montadas.
- **FR-004**: Las pestañas MUST manejarse con toque, deslizamiento y teclado, con roles ARIA `tablist`/`tab`/`tabpanel`.
- **FR-005**: La barra inferior MUST verse solo en pantallas principales y respetar las zonas seguras.

### Fotos (US3)

- **FR-006**: Avatar y foto de grupo MUST aceptar hasta 25 MB y subirse como JPG ≤ 2 MB y ≤ 1280 px por lado.
- **FR-007**: El límite del backend (2 MB) MUST NOT cambiar.

### Notificaciones (US4)

- **FR-010**: La app MUST pedir permiso de notificaciones al iniciar sesión, una sola vez, y solo si fue compilada con Firebase.
- **FR-011**: Con permiso, la app MUST registrar el teléfono con `PUT /api/users/me/push-devices` ([contrato](./contracts/push-devices-api.md)).
- **FR-012**: Un token MUST pertenecer a una sola cuenta: registrarlo desde otra sesión lo reasigna.
- **FR-013**: Al cerrar sesión la app MUST borrar el token con `DELETE /api/users/me/push-devices` antes de cerrar la sesión.
- **FR-014**: Al crearse una solicitud de amistad, el backend MUST notificar a todos los teléfonos del destinatario **después del commit**, de forma asíncrona.
- **FR-015**: Los tokens que Firebase informe como inexistentes MUST borrarse.
- **FR-016**: Sin credenciales de Firebase el backend MUST arrancar normalmente y no enviar nada.
- **FR-017**: Al tocar una notificación la app MUST abrir `data.route` si es una ruta interna.
- **FR-018**: Con la app en primer plano MUST mostrarse un aviso interno y recargarse la campanita.
- **FR-019**: Ni el token, ni la clave de Firebase, ni el mail del destinatario MUST aparecer en los logs.

### Key Entities

- **Teléfono registrado** (`push_devices`): cuenta, token de FCM (único), plataforma (`ANDROID`), alta y última vez visto. Ver [data-model.md](./data-model.md).
- **Mensaje push**: título, texto, ruta a abrir y etiqueta de agrupación. No se guarda.

## Success Criteria *(mandatory)*

- **SC-001**: Inicio, Grupo, Amigos y Estadísticas entran en una pantalla de 390 × 844 por pestaña con hasta 5 elementos.
- **SC-002**: Una foto de cámara de 12 MP se sube como avatar sin errores (medido: 14 MB → 457 KB en 0,2 s).
- **SC-003**: Una solicitud de amistad llega al celular en menos de 10 s en el 95 % de los casos.
- **SC-004**: Con Firebase caído o sin configurar, enviar una solicitud no tarda más que antes de 002.
- **SC-005**: Las pruebas del frontend y del backend pasan, con cobertura ≥ 85 %.

## Assumptions

- Hay un proyecto de Firebase del equipo (plan gratuito Spark) con la app Android `com.amano.app` registrada. Los pasos están en [quickstart.md](./quickstart.md) §2.
- La app se distribuye como APK de depuración entre el equipo; no hay publicación en Play Store en este alcance.
- iOS queda fuera de alcance.
