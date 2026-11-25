# Feature Specification: App Android sobre el sprint 6 y repositorio propio

> **Numeración**: `001`–`003` son specs de este repositorio (amano-mobile); `web-NNN` son specs del repositorio web (`amano`).

**Feature Branch**: `feat/android-sprint-6` (repo web) · `main` (repo móvil)

**Created**: 2026-11-25

**Status**: Implementado (pendiente de verificación en dispositivo)

**Input**: "Generamos un nuevo repositorio pura y exclusivamente para el mobile [...] te paso la última versión para que me actualices la aplicación, después la corremos en el celu y me ayudás a subir al repo las dos specs y el código de la aplicación."

## Contexto

- El sprint 6 del repositorio web agrega **web-035 (bandeja de notificaciones in-app)**: tabla `notifications`, preferencias por canal y por tipo, popover de la campana, página `/notifications` y ocho tipos de aviso. También saca las pantallas de Ajustes y Preguntas frecuentes y lleva el cambio de tema y el cierre de sesión a la barra superior.
- **002** mandaba al celular solo las solicitudes de amistad, con un aviso propio. Con web-035 eso queda duplicado: 003 lo reemplaza por el aviso de la bandeja.
- La app pasa a tener **repositorio propio**. El código compartido con la web (diseño móvil, fotos, cliente de push, endpoints de teléfonos) sigue en el repositorio web porque es el mismo frontend y el mismo backend.

## Clarifications

### Session 2026-11-25

- Q: ¿Qué avisos llegan al celular ahora? → A: Todos los que entran a la bandeja (web-035): recordatorios, silbatos, deudas vencidas, avisos al pagador, gastos de grupo, pagos registrados, solicitudes de amistad y actividad social.
- Q: ¿Respeta las preferencias de notificación? → A: Sí. Llega al celular exactamente lo que se guarda en la bandeja: el tipo tiene que estar activo y el canal In-App también. Desactivar el canal In-App también apaga el push.
- Q: ¿Qué pasa al tocar la notificación? → A: Lo mismo que un clic en la campana: se marca como leída y se abre el destino (grupo, deudas del grupo, actividad o amigos).
- Q: ¿Dónde quedan tema y cerrar sesión en la app? → A: En el menú "Más", junto con Notificaciones, Amigos, Buscar personas, Estadísticas y Gastos recurrentes. Ajustes y Preguntas frecuentes se quitan porque la web ya no las tiene.
- Q: ¿Cómo se arma el repositorio móvil? → A: Specs + proyecto Capacitor. El frontend se compila desde el repositorio web (submódulo `web/`, carpeta `../amano` o `AMANO_WEB_DIR`) y la salida va a `www/`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Todas las notificaciones en el celular (Priority: P1)

**Independent Test**: Con Firebase configurado y la app en segundo plano, otra persona carga un gasto en un grupo compartido: en el celular aparece "Nuevo gasto en …" y al tocarla se abre el grupo y la campanita baja en uno.

**Acceptance Scenarios**:

1. **Given** permiso de notificaciones y el canal In-App activo, **When** se guarda en la bandeja una notificación de cualquiera de los ocho tipos, **Then** llega al celular con el mismo título y texto.
2. **Given** el tipo de evento o el canal In-App desactivados en las preferencias, **When** ocurre el evento, **Then** no llega nada al celular.
3. **Given** una notificación en el celular, **When** se toca, **Then** la notificación queda leída en la bandeja y se abre el mismo destino que en la campana; si el destino no existe, se abre `/notifications`.
4. **Given** una solicitud de amistad, **Then** llega **una sola** notificación (no la de 002 más la de la bandeja).
5. **Given** la app abierta, **When** llega un aviso, **Then** se muestra en el snackbar y la campanita se recarga.
6. **Given** Firebase caído o sin configurar, **Then** la bandeja, el correo y la operación que originó el aviso funcionan igual.

### User Story 2 - La app trae todo el sprint 6 (Priority: P1)

**Acceptance Scenarios**:

1. **Given** la app, **When** se abre la campana, **Then** se ve el popover de web-035 a todo el ancho y "Ver todas las notificaciones" abre la bandeja con la barra inferior visible.
2. **Given** el menú "Más", **Then** ofrece Mi perfil, Notificaciones, Amigos, Buscar personas, Estadísticas, Gastos recurrentes, cambio de tema y Cerrar sesión; no hay enlaces a pantallas que ya no existen.
3. **Given** las pantallas nuevas del sprint 6, **When** llaman a la API, **Then** funcionan en la app (pasan por `apiUrl`).

### User Story 3 - Repositorio propio para la app (Priority: P2)

**Acceptance Scenarios**:

1. **Given** el repositorio móvil clonado con el web como submódulo o al lado, **When** se corre `npm install && npm run android`, **Then** se compila el frontend del repositorio web y la app se instala en el teléfono.
2. **Given** que no se encuentra el repositorio web, **Then** el script explica las tres formas de indicarlo.
3. **Given** Java 25 como `JAVA_HOME`, **Then** el script avisa que Android necesita Java 21 y cómo instalarlo.
4. **Given** `npm run apk`, **Then** queda `amano.apk` en la raíz del repositorio.

## Requirements *(mandatory)*

- **FR-001**: Cada notificación que `NotificationDeliveryService` (web-035) guarde en la bandeja MUST enviarse a los teléfonos de esa cuenta, de forma asíncrona y sin afectar la entrega por bandeja o correo.
- **FR-002**: Si la notificación no se pudo guardar, MUST NOT enviarse al celular.
- **FR-003**: El mensaje push MUST incluir `data.route` (mismo destino que `frontend/src/utils/notificationTarget.js`) y `data.notificationId`.
- **FR-004**: Al tocar la notificación, la app MUST marcarla como leída (`PATCH /api/v1/notifications/{id}/read`) y navegar a `data.route`; si marcarla falla, navega igual.
- **FR-005**: El aviso propio de solicitudes de amistad de 002 (`FriendshipRequestCreatedEvent`, `FriendshipRequestPushListener`) MUST eliminarse.
- **FR-006**: La migración de teléfonos MUST ser `V40__create_push_devices.sql` (web-035 usa V39).
- **FR-007**: `notificationsClient.js` (nuevo en el sprint 6) MUST usar `apiUrl`.
- **FR-008**: El menú "Más" MUST reflejar la navegación del sprint 6 (US2.2) y `/notifications` MUST ser una pantalla principal (con barra inferior).
- **FR-009**: Los scripts del repositorio móvil MUST encontrar el repositorio web por `AMANO_WEB_DIR`, `web/` o `../amano`, compilar con `VITE_PUSH_ENABLED` y dejar la salida en `www/`.
- **FR-010**: Los comentarios del código que la app agregó al repositorio web MUST referirse a estas specs como `mobile 001/002/003` (en el repositorio web "035" es la bandeja).

## Success Criteria *(mandatory)*

- **SC-001**: Un gasto de grupo llega al celular en menos de 10 s en el 95 % de los casos.
- **SC-002**: Una solicitud de amistad produce exactamente una notificación en el celular.
- **SC-003**: Las pruebas de backend y frontend del repositorio web pasan con cobertura ≥ 85 %.
- **SC-004**: Un integrante nuevo instala la app desde cero siguiendo solo el README del repositorio móvil.
