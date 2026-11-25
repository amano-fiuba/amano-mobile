# Tasks: Aplicación móvil para Android

**Input**: Design documents from `/specs/001-android-app/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: incluidas (constitución V). La guardia de FR-006 se escribe junto con el módulo que protege.

**Organization**: tareas agrupadas por historia de usuario. Las marcadas `[x]` tienen el código escrito; las verificaciones (T018-T024) quedan abiertas hasta ejecutarlas en una máquina del equipo y en un teléfono.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1 a US4; sin etiqueta en Setup, Foundational y Polish

## Path Conventions

- Frontend: `frontend/src/…`, pruebas `*.test.js` junto al código
- Módulo móvil: `mobile/…`
- Sin cambios en `backend/`

---

## Phase 1: Setup

- [ ] T001 Crear la rama `feat/android-app` desde `sprint-3` con web-001 a web-014 integradas
- [x] T002 Crear `mobile/package.json` con Capacitor 8 (`core`, `android`, `app`, `cli`) y los scripts `build:web`, `setup:android`, `sync`, `open`, `android` — research.md D5/D6/D10, FR-015
- [x] T003 [P] Crear `mobile/.gitignore` (node_modules y assets generados por `cap sync`) — FR-015
- [x] T004 [P] Agregar `dist-android` a `frontend/.gitignore` y a `globalIgnores` de `frontend/eslint.config.js`

---

## Phase 2: Foundational

- [x] T005 Crear `frontend/src/api/apiBase.js` con `normalizeBase()` y `apiUrl(path, base)` leyendo `VITE_API_BASE_URL` — research.md D3, FR-004/FR-005
- [x] T006 Agregar el script `build:android` (`vite build --mode android --outDir dist-android --emptyOutDir`) a `frontend/package.json` — D3
- [x] T007 Crear `frontend/.env.android` con la URL de producción y agregar la excepción `!frontend/.env.android` al `.gitignore` raíz — D9, FR-005

**Checkpoint**: `npm run build:android` genera `frontend/dist-android/` con la base embebida; `npm run build` sigue generando `dist/` sin base.

---

## Phase 3: User Story 1 - Todas las funciones en el celular (Priority: P1) 🎯 MVP

### Tests for User Story 1

- [x] T008 [P] [US1] Crear `frontend/src/api/apiBase.test.js`: base vacía conserva la ruta, base configurada la antepone, barras finales y espacios — FR-004/FR-005

### Implementation for User Story 1

- [x] T009 [US1] Reemplazar cada `fetch('/api/...')` por `fetch(apiUrl('/api/...'))` en `authClient.js`, `expenseClient.js`, `friendsClient.js`, `groupsClient.js` (incluye `deletionRequest` y `jsonRequest`), `usersClient.js` y `auth/AuthContext.jsx` — FR-001/FR-003
- [x] T010 [US1] Crear `mobile/capacitor.config.json` con `appId` `com.amano.app`, `appName` "A mano" y `webDir` `../frontend/dist-android` — FR-002/FR-009

**Checkpoint**: la app compila y muestra la portada.

---

## Phase 4: User Story 2 - Sesión persistente y segura (Priority: P1)

- [x] T011 [US2] Habilitar `CapacitorHttp` y `CapacitorCookies` en `mobile/capacitor.config.json` — research.md D4, FR-007/FR-008
- [x] T012 [US2] Crear `mobile/templates/debug-AndroidManifest.xml` (HTTP sin TLS solo en debug) y `mobile/scripts/setup-android.mjs` que genera `android/` y lo copia a `android/app/src/debug/` — D9, FR-014/FR-015
- [ ] T013 [US2] Ejecutar `npm install` y `npm run setup:android` en `mobile/` y versionar `mobile/android/` y `mobile/package-lock.json` — FR-015

**Checkpoint**: login, cierre y reapertura conservan la sesión.

---

## Phase 5: User Story 3 - Experiencia de app (Priority: P2)

- [x] T014 [P] [US3] Sumar `--safe-area-inset-*` (con `env()` y `0px` de respaldo) al relleno de `body` y `.site-nav` (incluida la variante `max-width: 560px`) en `frontend/src/index.scss`; agregar `viewport-fit=cover` en `frontend/index.html`; `SystemBars.insetsHandling: "css"` en la config — D7, FR-010
- [x] T015 [P] [US3] Incluir `@capacitor/app` en `mobile/package.json` sin listeners para el botón Atrás — D6, FR-011
- [ ] T016 [US3] (Opcional) Generar el ícono desde `frontend/public/logo.png` con *Android Studio → New → Image Asset* sobre `mobile/android` — FR-009

---

## Phase 6: User Story 4 - Actualizar la app cada semana (Priority: P2)

- [x] T017 [US4] Agregar a `apiBase.test.js` la guardia que inspecciona el código fuente con `import.meta.glob` y falla si algún `fetch` recibe un literal `/api...` — FR-006

---

## Phase 7: Polish & verificación

- [ ] T018 Ejecutar en `frontend/`: `npm ci && npm run lint && npm run test:coverage && npm run build && npm run build:android` y registrar el resultado (cobertura ≥ 85 %) — constitución V/X, SC-003
- [ ] T019 Comprobar que `git diff sprint-3 -- backend compose.yaml compose.prod.yaml frontend/Dockerfile frontend/nginx.conf` está vacío — FR-016, SC-002
- [ ] T020 [US1] Recorrer el checklist de quickstart §5 en un teléfono contra producción — SC-001
- [ ] T021 [US2] Verificar en el teléfono persistencia de sesión y cierre de sesión — SC-006
- [ ] T022 [US1] Verificar en el teléfono las tres subidas multipart (registro con avatar, avatar, foto de grupo) — research.md D4 (riesgo)
- [ ] T023 [US4] Hacer un cambio visible en el frontend, `npm run android` y comprobar que aparece — SC-005
- [ ] T024 Repetir T020 contra el backend local con `adb reverse` — D9
- [x] T025 [P] Documentar el módulo en `mobile/README.md` y enlazarlo desde el `README.md` raíz
- [ ] T026 Abrir el PR hacia `sprint-3` con Conventional Commits (`feat(mobile): ...`, `feat(frontend): ...`, `docs(specs): ...`) — constitución XII/XIII

---

## Phase 8: Actualización a sprint-4 (2026-11-05)

- [x] T027 Integrar la feature sobre `sprint-4` (incluye web-015 pantalla principal) sin conflictos
- [x] T028 [US4] Pasar por `apiUrl` el `fetch` nuevo de `listRecentExpenses` en `frontend/src/api/expenseClient.js` (detectado por la guardia de FR-006)
- [x] T029 [P] [US1] Crear `frontend/src/api/apiImage.js` y `frontend/src/components/ApiImage.jsx` con sus pruebas en `ApiImage.test.jsx` — research.md D12, FR-017
- [x] T030 [US1] Reemplazar `<img>` por `<ApiImage>` en las imágenes servidas por la API: `AppHeader`, `ProfileSummary`, `RecentGroups`, `MemberListView`, `GroupPhotoPanel`, `ProfilePage`, `ProfileEditPage`, `GroupListView` — FR-017
- [x] T031 [P] [US3] Sumar zonas seguras a los elementos nuevos de web-015: `.app-header` (y su variante móvil), `.quick-actions`, `.snackbar` y `.theme-toggle` — FR-010
- [ ] T032 [US1] Verificar en el dispositivo que se ven el avatar propio (barra, pantalla principal, perfil, edición), los avatares de miembros y las fotos de grupo — SC-007
- [ ] T033 Repetir T018 sobre `sprint-4`

---

## Phase 9: Actualización a feat/recurrence-due-dates (2026-11-10)

- [x] T034 Integrar la feature sobre `feat/recurrence-due-dates` (contiene `sprint-4` y `feat/envio-recordatorio-deudas`); conflictos en 6 componentes de imagen resueltos tomando el diseño nuevo y reaplicando `ApiImage`
- [x] T035 [US4] Pasar por `apiUrl` los `fetch` nuevos de `groupExpensesClient.js` (incluye `getJson`), `paymentsClient.js`, `currencyClient.js`, `groupsClient.js` (recordatorios, candidatos, recurrentes, cotización), `friendsClient.js` y `expenseClient.js` — FR-006
- [x] T036 [US1] Reemplazar por `<ApiImage>` los 18 `<img>` dinámicos: `NotificationsMenu`, `FriendsList`, `MemberListView`, `GroupPhotoPanel`, `ProfilePage`, `UsersSearchPage`, `FriendsPage`, `GlobalSearch` (2), `AppHeader`, `FriendChooserDialog`, `FriendPicker`, `PeopleChips`, `GroupChooserDialog`, `AddMemberView`, `RecentGroups`, `GroupListView` — FR-017
- [x] T037 [US4] Agregar a `ApiImage.test.jsx` la guardia de `<img>` con `src` dinámico — FR-018
- [x] T038 Documentar la compatibilidad app/backend en research.md D13 y quickstart §4 — FR-019
- [ ] T039 Repetir T018 y el checklist de quickstart §5 contra el backend local de esta rama
- [x] T040 (2026-11-11) Verificar que el `sprint-4` actualizado coincide con `feat/recurrence-due-dates`: sin diferencias, la feature queda sobre `sprint-4` sin cambios de código

---

## Phase 10: Reaplicación sobre main (2026-11-22)

- [x] T041 Reaplicar la feature completa sobre `main` (no traía 001): `apiUrl` en los 65 `fetch` (nuevos: `incomeClient`, `statisticsClient`, búsquedas de actividad), `ApiImage` en los 18 `<img>` dinámicos, módulo `mobile/`, guardias
- [x] T042 Diseño móvil, fotos pesadas y notificaciones: ver [002-diseno-movil-y-notificaciones](../002-diseno-movil-y-notificaciones/tasks.md)
- [ ] T043 Repetir T018 y el checklist de quickstart §5 sobre `main`

## Dependencies & Execution Order

- Setup (T001-T004) → Foundational (T005-T007) → US1 (T008-T010) → US2 (T011-T013) → US3 (T014-T016) / US4 (T017) → Polish (T018-T026).
- T013 requiere T002, T010, T011 y T012, y una máquina con Android Studio y red.
- T020-T024 requieren T013 y un teléfono con depuración USB.
- Si T021 o T022 fallan, aplicar el plan B de research.md D2 y actualizar spec/research antes de seguir (constitución II).
