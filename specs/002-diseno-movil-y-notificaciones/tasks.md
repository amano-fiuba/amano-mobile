# Tasks: 002 — App Android completa

## Fase 1: Reaplicar 001 sobre `main` (US1)

- [x] T001 `api/apiBase.js` y `apiUrl()` en los 65 `fetch` de los clientes y `AuthContext` (incluye `incomeClient` y `statisticsClient`)
- [x] T002 `api/apiImage.js` + `components/ApiImage.jsx` en los 18 `<img>` dinámicos
- [x] T003 Guardias: `api/apiBase.test.js`, `components/ApiImage.test.jsx`
- [x] T004 Módulo `mobile/` (Capacitor 8), `frontend/.env.android`, script `build:android`, `viewport-fit=cover`

## Fase 2: Diseño móvil (US2)

- [x] T010 `mobile/mobileLayout.js` (detección, `?mobile=1`, rutas de primer nivel)
- [x] T011 `mobile/MobileTabs.jsx` + pruebas (web idéntica, pestañas, deslizar, teclado, orden, pasos)
- [x] T012 Barra superior compacta y `mobile/MobileTabBar.jsx` con hoja "Más" + pruebas
- [x] T013 Pestañas en Inicio, Grupo, Amigos y Estadísticas; filtros plegables en Actividad
- [x] T014 Pasos en el alta de gasto grupal; botones fijos en formularios
- [x] T015 `mobile/MobileWelcome.jsx`
- [x] T016 `mobile/mobile.scss` (zonas seguras, todo bajo `.is-mobile-app`)

## Fase 3: Fotos pesadas (US3)

- [x] T020 `utils/imagePrep.js` + pruebas
- [x] T021 Usarlo en `AvatarUploader`, `ProfileEditPage` y `GroupEditForm`; `accept="image/*"`
- [x] T022 Ajustar pruebas existentes (límite 25 MB, foto de grupo con bytes PNG reales)

## Fase 4: Notificaciones (US4)

- [x] T030 `V40__create_push_devices.sql` (V39 en la primera versión; ver 003), `PushDevice`, `PushDeviceRepository`
- [x] T031 `PushDeviceService` + `PushDeviceController` (PUT/DELETE) + `PushDeviceServiceTest` + `PushDeviceIT`
- [x] T032 `FirebaseServiceAccount`, `FcmPushSender`, `PushConfig`, `DisabledPushSender` + `FcmPushSenderTest`
- [x] T033 `PushNotificationService` (@Async, borra tokens muertos) + `PushNotificationServiceTest`
- [x] T034 `FriendshipRequestCreatedEvent` publicado por `FriendshipRequestService`; `FriendshipRequestPushListener` (AFTER_COMMIT)
- [x] T035 `FIREBASE_CREDENTIALS_BASE64` en `application.properties`, `compose*.yaml` y `.env.example`
- [x] T036 `api/pushClient.js`, `mobile/nativePush.js` + pruebas
- [x] T037 `mobile/PushNotifications.jsx` (permiso, tocar → abrir ruta, aviso en primer plano) + pruebas
- [x] T038 Borrar el token antes del logout (`authClient.logout`)
- [x] T039 `mobile/`: plugin `@capacitor/push-notifications`, `build-web.mjs` (`VITE_PUSH_ENABLED`), `setup-android.mjs` (google-services, ícono, canal, color), script `apk`

## Fase 5: Verificación (pendiente, en una máquina con acceso a npm y Maven)

- [ ] T050 `cd backend && ./mvnw verify`
- [ ] T051 `cd frontend && npm ci && npm run lint && npm run test:coverage && npm run build && npm run build:android`
- [ ] T052 Configurar Firebase ([quickstart §2](./quickstart.md#2-configurar-firebase-una-vez-por-equipo))
- [ ] T053 `cd mobile && npm install && npm run android`; recorrer el checklist
- [ ] T054 Versionar `mobile/package-lock.json` (y `mobile/google-services.json` si el equipo lo decide)

## Checklist en el dispositivo

- [ ] Todo lo de [001 quickstart §5](../001-android-app/quickstart.md) más web-029 a web-034.
- [ ] Barra inferior en Inicio, Grupos y Actividad; "Más" abre la hoja; se oculta en formularios.
- [ ] Pestañas en Inicio, Grupo, Amigos y Estadísticas; deslizar cambia de pestaña.
- [ ] Gasto grupal: paso 1 → "Siguiente: reparto" → paso 2 → Guardar.
- [ ] Foto de perfil con una foto de la cámara (> 5 MB) y foto de grupo desde la galería.
- [ ] Ninguna pantalla queda tapada por la barra de estado ni por la barra de gestos.
- [ ] Notificaciones: los 6 pasos de [quickstart §3](./quickstart.md#3-probar-las-notificaciones).
