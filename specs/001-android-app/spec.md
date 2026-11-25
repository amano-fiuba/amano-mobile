# Feature Specification: Aplicación móvil para Android

> **Numeración en este repositorio (amano-mobile)**: `001` y `002` son las specs de la app móvil. Las referencias `web-NNN` son las specs del repositorio de la aplicación web (`amano`), por ejemplo `web-015` = `015-main-screen`. Esta spec se escribió originalmente como `019-android-app` del repositorio web; las rutas de archivos (`frontend/`, `backend/`, `mobile/`) son las de ese monorepo, donde está implementada.

**Feature Branch**: `feat/android-app` (base: `sprint-4`)

**Created**: 2026-11-05

**Status**: Implemented sobre `sprint-4` (pendiente verificación local y en dispositivo)

**Updated**: 2026-11-05 — actualización a `sprint-4` (incluye web-015 pantalla principal) y carga de imágenes protegidas (FR-017)

**Updated**: 2026-11-10 — actualización a `feat/recurrence-due-dates` (sprint-4 + web-016 a web-018, web-020 a web-028); FR-017 extendido a todas las imágenes dinámicas y guardia automática (FR-018); compatibilidad app/backend (FR-019)

**Updated**: 2026-11-11 — `sprint-4` ya incluye `feat/recurrence-due-dates` y `feat/envio-recordatorio-deudas` (código idéntico al de la actualización anterior); la base vuelve a ser `sprint-4`, sin cambios de código

**Updated**: 2026-11-22 — esta feature nunca llegó a `main`; se reaplicó completa sobre `main` (web-001 a web-034) y se extendió con el diseño móvil, las fotos pesadas y las notificaciones en el celular en [002-diseno-movil-y-notificaciones](../002-diseno-movil-y-notificaciones/spec.md). Donde haya diferencias, manda 002.

**Input**: User description: "Desarrollar una aplicación mobile para Android que contenga todo el contenido actual de A mano, bien completo, y que se pueda ir actualizando semana a semana a medida que la web crece."

## Relación con otras especificaciones

- **Cubre web-001 a web-018 y web-020 a web-028 sin reimplementarlas** (base actual: `sprint-4`, que ya integra `feat/envio-recordatorio-deudas` y `feat/recurrence-due-dates`): la app ofrece exactamente las mismas pantallas, validaciones y mensajes que la web, porque empaqueta el mismo frontend. Ninguna regla de negocio se duplica (constitución VI).
- **Reutiliza la sesión de web-001/web-003/web-004**: la cookie `amano_auth` (HttpOnly, SameSite=Strict) sigue siendo el único mecanismo de autenticación. No se crean tokens, cabeceras ni endpoints nuevos (constitución IX).
- **No modifica el backend ni los contratos REST**: todos los contratos de `specs/*/contracts/` se consumen tal cual (constitución VII).
- **Modifica el frontend solo en su borde**: la URL base de la API pasa a ser configurable y las imágenes servidas por la API (avatares y fotos de grupo) usan un componente que en la web dibuja el mismo `<img>`; en la web el comportamiento no cambia.

Los identificadores FR-### y SC-### de esta especificación son propios de 001.

## Clarifications

### Session 2026-11-05

- Q: ¿"Todo el contenido" significa todas las funcionalidades de web-001 a web-014? → A: Sí: registro, verificación, login, recuperación de contraseña, perfil y edición, gastos y recurrentes, buscador, amistades, grupos completos e historial.
- Q: ¿App nativa reescrita o la web empaquetada? → A: La web empaquetada en una app nativa (research.md D1). Una reescritura duplicaría 14 features y obligaría a mantener dos versiones cada semana.
- Q: ¿La app incluye las pantallas dentro del APK o abre el sitio publicado? → A: Las incluye (research.md D2); solo la API es remota.
- Q: ¿Contra qué servidor trabaja la app? → A: Por defecto, el despliegue de producción por HTTPS. Para desarrollo se puede apuntar al backend local (research.md D9). **Pendiente de confirmar por el equipo**: el dominio definitivo (hoy `amano-fiuba.duckdns.org`, tomado de `.env.example`).
- Q: ¿Los enlaces de los correos (verificar cuenta, restablecer contraseña) abren la app? → A: No en esta historia: abren la web en el navegador, que ya resuelve esos flujos. Después la persona inicia sesión en la app. Los enlaces profundos (App Links) quedan como decisión pendiente (research.md D8).
- Q: ¿Se publica en Google Play? → A: No. Se instala en modo desarrollo desde Android Studio o con un APK de depuración.
- Q: ¿iOS? → A: Fuera de alcance.

### Session 2026-11-05 (actualización a sprint-4)

- Q: (2026-11-11) ¿Cambia algo con el `sprint-4` nuevo? → A: No en el código: es idéntico a `feat/recurrence-due-dates`. La base de la rama `feat/android-app` pasa a ser `sprint-4`.
- Q: (2026-11-10) ¿Sobre qué código se arma la app? → A: Sobre `feat/recurrence-due-dates`, la rama más completa (incluye `sprint-4` y `feat/envio-recordatorio-deudas`). La app debe usarse contra un backend con ese mismo código (FR-019).
- Q: Las fotos (avatar, miembros, grupos) se piden con `<img src="/api/...">` y necesitan la cookie; dentro de la app no se ven. ¿Se pasa a abrir la web publicada (research.md D2, plan B) o se mantienen las pantallas en la app? → A: Se mantienen las pantallas en la app y las imágenes protegidas se cargan por la capa nativa (research.md D12, FR-017).
- Q: Numeración → A: originalmente `019-android-app` en el repositorio web (web-015 es la pantalla principal; web-016 a web-018 quedaban para otras historias); en el repositorio móvil es `001-android-app`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usar A mano desde el celular con todas sus funciones (Priority: P1) 🎯 MVP

Una persona instala la app en su teléfono Android, se registra o inicia sesión y usa todas las funciones que hoy ofrece la web: perfil, gastos, gastos recurrentes, buscador, amistades y grupos con su historial.

**Why this priority**: Es el valor completo del pedido: sin esto no hay app.

**Independent Test**: Instalar la app en un teléfono, iniciar sesión con una cuenta verificada y recorrer cada sección de la barra de navegación ejecutando una acción en cada una.

**Acceptance Scenarios**:

1. **Given** la app instalada y una cuenta verificada, **When** la persona inicia sesión, **Then** entra a la pantalla principal igual que en la web.
2. **Given** una sesión iniciada, **When** recorre la pantalla principal, el buscador, "Grupos", "Registrar gasto", "Gastos recurrentes", "Mi perfil", "Amigos", notificaciones, preguntas frecuentes y ajustes, **Then** cada pantalla carga sus datos y permite las mismas acciones que la web.
3. **Given** una cuenta nueva, **When** completa el registro en la app, **Then** ve "Revisa tu correo" igual que en la web.
4. **Given** cualquier error de validación o de negocio definido en web-001 a web-014, **When** ocurre en la app, **Then** se muestra el mismo mensaje que en la web.

---

### User Story 2 - Sesión persistente y segura (Priority: P1)

La sesión iniciada en la app se mantiene al cerrar y volver a abrir la app mientras la cookie siga vigente (24 h), y "Cerrar sesión" la termina igual que en la web.

**Why this priority**: Sin sesión estable la app es inutilizable; y el mecanismo debe ser el ya existente.

**Independent Test**: Iniciar sesión, cerrar la app desde el gestor de tareas, abrirla y comprobar que sigue la sesión; cerrar sesión y comprobar que una pantalla protegida redirige al acceso.

**Acceptance Scenarios**:

1. **Given** una sesión iniciada, **When** la persona cierra y vuelve a abrir la app antes de que venza la cookie, **Then** sigue con la sesión.
2. **Given** una sesión iniciada, **When** toca "Cerrar sesión", **Then** vuelve a la pantalla pública y una ruta protegida redirige al acceso.
3. **Given** una sesión vencida, **When** la app consulta la API, **Then** se comporta como la web ante un 401.
4. **Given** el uso de la app, **When** se inspecciona el backend, **Then** no existe ningún endpoint, cabecera ni token nuevo: la autenticación es la cookie `amano_auth`.

---

### User Story 3 - Experiencia de app en el teléfono (Priority: P2)

La app se comporta como una app de Android: ícono y nombre "A mano", botón Atrás del sistema que vuelve a la pantalla anterior, contenido que no queda tapado por la barra de estado, fotos de perfil y de grupo elegidas desde la galería y enlaces externos abiertos en el navegador.

**Why this priority**: Mejora la experiencia; las funciones ya están cubiertas por US1.

**Independent Test**: Navegar varias pantallas y volver con Atrás; subir un avatar y una foto de grupo desde la galería; tocar el enlace al repositorio en la portada.

**Acceptance Scenarios**:

1. **Given** varias pantallas visitadas, **When** la persona toca Atrás, **Then** vuelve a la anterior; en la primera pantalla, Atrás cierra la app.
2. **Given** la barra de navegación de A mano, **When** se muestra en un teléfono con barra de estado o recorte de cámara, **Then** ningún enlace queda tapado.
3. **Given** "Editar perfil" o "Foto del grupo", **When** la persona elige una imagen, **Then** se abre el selector del sistema y la imagen se sube con las mismas validaciones de la web.
4. **Given** un enlace a un sitio externo, **When** se toca, **Then** se abre en el navegador del teléfono y no dentro de la app.

---

### User Story 4 - Actualizar la app cada semana (Priority: P2)

Cuando la web incorpora funcionalidades nuevas, el equipo actualiza la app recompilando, sin escribir código específico de la app.

**Why this priority**: Es la condición explícita del pedido ("ir actualizándola semana a semana").

**Independent Test**: Agregar un cambio visible al frontend, ejecutar el comando de sincronización y comprobar que aparece en la app instalada.

**Acceptance Scenarios**:

1. **Given** un cambio en `frontend/`, **When** se ejecuta `npm run android` en `mobile/`, **Then** la app instalada muestra el cambio.
2. **Given** una llamada nueva a la API escrita sin la URL base configurable, **When** se ejecutan las pruebas del frontend, **Then** fallan e indican el archivo.

---

### Edge Cases

- **Sin conexión**: la app abre (las pantallas están empaquetadas) y las llamadas fallan con los mismos mensajes de error de red que la web.
- **Backend local por HTTP**: solo se permite en builds de depuración; el build de release exige HTTPS.
- **Enlaces de correo abiertos en el teléfono**: abren la web en el navegador; tras verificar o restablecer, la persona inicia sesión en la app.
- **Cookie `SameSite=Strict` con la app en otro origen**: las peticiones a la API se hacen por la capa HTTP nativa, que guarda y envía la cookie sin las restricciones del navegador (research.md D4).
- **Subidas multipart** (registro con avatar, avatar, foto de grupo): pasan por la misma capa nativa; se verifican explícitamente en dispositivo (quickstart §5).
- **Imágenes protegidas** (avatares en cualquier pantalla, fotos de grupo): mientras cargan, o si fallan, se muestra el avatar por defecto; nunca una imagen rota.
- **App más nueva que el backend**: si la app incluye pantallas cuyo endpoint todavía no existe en el servidor al que apunta (por ejemplo, recordatorios o recurrentes de grupo contra un producción viejo), esas pantallas muestran el error de red ya definido; el resto funciona.
- **Elementos fijos** (barra superior, botón "+", avisos, selector de tema): respetan la barra de estado y la barra de gestos.
- **Rutas internas con recarga completa** (por ejemplo, `<a href="/login">`): el servidor local de la app devuelve `index.html` y el router resuelve la ruta.
- **Tema oscuro guardado**: persiste en la app igual que en el navegador.
- **Versión de la app anterior al backend**: si el backend agrega un contrato incompatible, la app instalada falla igual que una pestaña vieja de la web; se resuelve recompilando (US4).

## Requirements *(mandatory)*

### Functional Requirements

**Cobertura funcional (US1)**

- **FR-001**: La app MUST ofrecer todas las pantallas y rutas de la SPA de web-001 a web-014, con el mismo comportamiento, validaciones y mensajes.
- **FR-002**: La app MUST empaquetar el frontend existente; MUST NOT reimplementar pantallas ni reglas de negocio.
- **FR-003**: La app MUST consumir los contratos REST existentes sin modificarlos.

**Configuración de la API (US1, US4)**

- **FR-004**: En la web, las llamadas MUST seguir usando rutas relativas `/api/...` (comportamiento idéntico al actual).
- **FR-005**: En el build Android, la URL base de la API MUST configurarse en tiempo de compilación, sin tocar código.
- **FR-006**: Toda llamada del frontend a la API MUST construir su URL con un único punto configurable; una prueba automatizada MUST detectar llamadas que no lo hagan.

**Sesión (US2)**

- **FR-007**: La app MUST autenticarse con la cookie `amano_auth` existente y MUST NOT introducir tokens, cabeceras ni endpoints nuevos.
- **FR-008**: La sesión MUST persistir entre aperturas de la app mientras la cookie esté vigente, y "Cerrar sesión" MUST eliminarla.

**Experiencia en Android (US3)**

- **FR-009**: La app MUST llamarse "A mano" y tener identificador `com.amano.app`.
- **FR-010**: El contenido MUST respetar las zonas seguras (barra de estado y recortes); en la web el diseño MUST NOT cambiar.
- **FR-011**: El botón Atrás del sistema MUST navegar el historial de la app y cerrarla en la primera pantalla.
- **FR-012**: La selección de imágenes MUST usar el selector del sistema.
- **FR-013**: Los enlaces a sitios externos MUST abrirse en el navegador del teléfono.

**Seguridad y entorno (US2, US4)**

- **FR-014**: El build de release MUST usar solo HTTPS; HTTP sin TLS MUST permitirse únicamente en builds de depuración.
- **FR-015**: La app MUST compilarse e instalarse con comandos documentados y reproducibles desde `mobile/`, sin pasos manuales sobre archivos generados.
- **FR-016**: La feature MUST NOT modificar el backend, las migraciones, `compose.yaml` ni la imagen Docker del frontend.

**Imágenes protegidas (US1, actualización sprint-4)**

- **FR-017**: Las imágenes que sirve la API (avatares y fotos de grupo, en cualquier pantalla) MUST verse en la app con la misma sesión; mientras cargan o si fallan MUST mostrar el avatar por defecto. En la web MUST renderizarse el mismo `<img src>` que antes.
- **FR-018**: Una prueba automatizada MUST fallar si algún componente dibuja un `<img>` con `src` dinámico en lugar de `ApiImage`.
- **FR-019**: La documentación MUST indicar que el APK se arma y se prueba contra un backend con el mismo código que el frontend empaquetado.

### Key Entities *(include if feature involves data)*

- No se agregan entidades. La app no guarda datos propios: usa los del backend y, como el navegador, la cookie de sesión y la preferencia de tema.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las rutas de `frontend/src/App.jsx` funciona en la app instalada (checklist de quickstart §5).
- **SC-002**: El 0 % de los archivos del backend cambia.
- **SC-003**: Las pruebas del frontend siguen pasando con cobertura ≥ 85 %.
- **SC-004**: Una persona del equipo con el entorno de first-steps instala la app en su teléfono siguiendo quickstart en menos de 30 minutos la primera vez.
- **SC-005**: Actualizar la app tras un cambio del frontend requiere un solo comando.
- **SC-006**: La sesión se conserva tras cerrar y abrir la app.
- **SC-007**: El 100 % de las imágenes protegidas que se ven en la web se ven también en la app.

## Assumptions

- El equipo usa Android Studio (Otter 2025.2.1 o posterior) y un teléfono con Android 7.0 (API 24) o superior y depuración USB habilitada.
- Node 24 de first-steps cumple el mínimo de Capacitor 8 (Node 22).
- El backend de producción está accesible por HTTPS en el dominio de `.env.example`.
- La app se distribuye solo en modo desarrollo (sin firma de release ni Play Store).
- Los textos siguen en español con voseo; no se agregan textos nuevos a las pantallas.
- Se agregan dependencias nuevas solo en el módulo nuevo `mobile/` (Capacitor); el frontend no suma dependencias.
