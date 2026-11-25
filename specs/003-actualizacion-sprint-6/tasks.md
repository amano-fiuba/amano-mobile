# Tasks: 003 — App Android sobre el sprint 6

## Repositorio web

- [x] T001 Mezcla de 3 vías (base `main`, sprint 6, app) y resolución de los 6 conflictos
- [x] T002 Quitar `FriendshipRequestCreatedEvent` y `FriendshipRequestPushListener`
- [x] T003 `NotificationDeliveryService`: push después de guardar; 3 pruebas nuevas en `NotificationDeliveryServiceTest`
- [x] T004 `PushMessage.forNotification` / `routeFor` + `PushMessageTest`; `notificationId` en `FcmPushSender` y su prueba
- [x] T005 Migración renombrada a `V40__create_push_devices.sql`
- [x] T006 `notificationsClient.js` con `apiUrl`
- [x] T007 `PushNotifications.jsx`: `markRead` al tocar, `/notifications` si no hay ruta; pruebas
- [x] T008 Menú "Más": Notificaciones, Buscar personas, tema, cerrar sesión; sin Ajustes ni FAQ; pruebas
- [x] T009 `/notifications` como pantalla principal
- [x] T010 Comentarios del código: `035`/`019` de la app → `mobile 002`/`mobile 001`
- [x] T011 Quitar `mobile/` y las specs de la app del repositorio web
- [ ] T012 `cd backend && ./mvnw verify`
- [ ] T013 `cd frontend && npm ci && npm run lint && npm run test:coverage`

## Repositorio móvil

- [x] T020 Specs 001 y 002 renumeradas; 003
- [x] T021 `scripts/web-dir.mjs`, `build-web.mjs` (salida `www/`), aviso de Java 21 en `setup-android.mjs`
- [x] T022 `npm run apk` deja `amano.apk` en la raíz
- [x] T023 README
- [ ] T024 Crear el repositorio, agregar `web/` como submódulo, primer push
- [ ] T025 `npm install && npm run android`; checklist de abajo
- [ ] T026 Versionar `package-lock.json`

## Checklist en el dispositivo

- [ ] Checklist de [002](../002-diseno-movil-y-notificaciones/tasks.md#checklist-en-el-dispositivo).
- [ ] Campana: popover a todo el ancho; "Ver todas" abre `/notifications` con barra inferior.
- [ ] Bandeja: filtros Todas / No leídas, marcar una y marcar todas, configuración.
- [ ] Menú "Más": cada enlace abre su pantalla; tema cambia; Cerrar sesión vuelve al login.
- [ ] Con Firebase: gasto de grupo, pago, silbato y solicitud de amistad llegan al celular; al tocar se abre el destino y la campanita baja.
