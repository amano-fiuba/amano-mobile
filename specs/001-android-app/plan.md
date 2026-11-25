# Implementation Plan: Aplicación móvil para Android

**Branch**: `feat/android-app` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-android-app/spec.md`

## Summary

Se crea una app Android que empaqueta la SPA existente con Capacitor 8 en el módulo nuevo `mobile/` (research.md D1, D2, D5). **US1**: todas las rutas de web-001 a web-014 funcionan porque es el mismo frontend; la única adaptación es que las llamadas a la API pasan por `apiUrl()`, con base vacía en la web y la URL del backend en el build Android (D3). **US2**: la cookie `amano_auth` se conserva usando HTTP nativo (`CapacitorHttp` + `CapacitorCookies`), sin tocar el backend (D4). **US3**: zonas seguras por CSS (D7), botón Atrás con `@capacitor/app` (D6), selector de imágenes y enlaces externos nativos de Capacitor. **US4**: un comando (`npm run android`) recompila y reinstala; una prueba impide llamadas a la API que salteen `apiUrl` (FR-006). **Cero cambios en el backend**, cero migraciones, ninguna dependencia nueva en el frontend.

## Technical Context

**Language/Version**: JavaScript con React 19.2 (frontend); configuración Capacitor (JSON) y un script Node ESM en `mobile/`

**Primary Dependencies**: existentes del frontend sin cambios. Nuevas, solo en `mobile/`: `@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/cli` (^8.0.0)

**Storage**: N/A (sin datos propios; cookie y tema como en el navegador)

**Testing**: Vitest + Testing Library (`apiBase.test.js` nuevo; las pruebas existentes de clientes siguen válidas porque la URL con base vacía es idéntica). Verificación manual en dispositivo con el checklist de quickstart §5.

**Target Platform**: Android 7.0+ (API 24), `targetSdk` 36; la web sigue igual

**Project Type**: monorepo web + módulo móvil nuevo

**Performance Goals**: sin metas nuevas; las de cada feature aplican igual

**Constraints**: sin cambios en backend, contratos, compose ni Docker (FR-016); HTTP sin TLS solo en debug (FR-014); cobertura frontend ≥ 85 %

**Scale/Scope** (sobre `sprint-4`): 6 archivos nuevos y 22 modificados en `frontend/`; módulo `mobile/` con 6 archivos; 1 línea en `.gitignore` raíz

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado | Evidencia |
|---|-----------|--------|-----------|
| I | Arquitectura y separación de responsabilidades | PASS | Reutiliza la SPA completa; módulo `mobile/` separado como `backend/` y `frontend/` (D1, D5) |
| II | Desarrollo guiado por especificaciones | PASS | `specs/001-android-app/` completa; FR citados en tareas y código |
| III | Entrega incremental por historia | PASS | US1 → US2 → US3 → US4 con checkpoints |
| IV | Alcance controlado | PASS con justificación | Dependencias nuevas solo en `mobile/`, imprescindibles para producir una app Android; App Links, iOS, Play Store y CI de Android fuera de alcance (D8, D11) |
| V | Calidad, pruebas y cobertura | PENDIENTE (verificación) | `apiBase.test.js` cubre el módulo nuevo; falta ejecutar `npm run test:coverage` (T018) |
| VI | Integridad de las reglas de negocio | PASS | Ninguna regla se duplica ni cambia |
| VII | Contratos REST y compatibilidad | PASS | Contratos sin cambios; mismas rutas |
| VIII | Validación y manejo de errores | PASS | Mismos mensajes; sin red, los errores de red ya definidos |
| IX | Seguridad y control de acceso | PASS | Misma cookie; sin CORS, sin tokens nuevos; HTTP solo en debug (D4, D9) |
| X | Código mantenible y convenciones | PASS | Nombres en inglés, `*.test.js`, sin código temporal |
| XI | Entorno reproducible | PASS con mejora pendiente | Comandos documentados; job de CI Android pendiente (D11) |
| XII | Revisión por pares | PENDIENTE (posterior) | PR aún no abierto |
| XIII | Commits y trazabilidad | PENDIENTE (posterior) | Los commits los realiza el equipo |

**Gate resultado**: PASS (con pendientes de verificación).

## Project Structure

### Documentation (this feature)

```text
specs/001-android-app/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

Sin `data-model.md` ni `contracts/`: la feature no agrega entidades ni endpoints.

### Source Code (repository root)

```text
frontend/
├── .env.android                 # A: VITE_API_BASE_URL del build Android (D3, D9)
├── .gitignore                   # M: ignora dist-android
├── eslint.config.js             # M: ignora dist-android
├── index.html                   # M: viewport-fit=cover (D7)
├── package.json                 # M: script build:android
└── src/
    ├── api/apiBase.js           # A: apiUrl() / normalizeBase() (FR-004/FR-005)
    ├── api/apiBase.test.js      # A: unitario + guardia FR-006
    ├── api/authClient.js        # M: fetch(apiUrl(...))
    ├── api/expenseClient.js     # M: idem
    ├── api/friendsClient.js     # M: idem
    ├── api/groupsClient.js      # M: idem
    ├── api/usersClient.js       # M: idem
    ├── auth/AuthContext.jsx     # M: idem
    ├── api/apiImage.js          # A: carga nativa de imágenes protegidas (FR-017, D12)
    ├── components/ApiImage.jsx  # A: <img> que usa apiImage dentro de la app
    ├── components/ApiImage.test.jsx # A
    ├── components/AppHeader.jsx, main/ProfileSummary.jsx, main/RecentGroups.jsx,
    │   groups/MemberListView.jsx, groups/GroupPhotoPanel.jsx, pages/ProfilePage.jsx,
    │   pages/ProfileEditPage.jsx, pages/groups/GroupListView.jsx  # M: <img> → <ApiImage>
    ├── components/AppHeader.scss, components/Snackbar.scss       # M: zonas seguras
    └── index.scss               # M: zonas seguras (FR-010)

mobile/                          # A: módulo nuevo (D5)
├── package.json                 # Capacitor 8 + scripts
├── capacitor.config.json        # appId, webDir, CapacitorHttp/Cookies, SystemBars
├── scripts/setup-android.mjs    # genera android/ y copia el manifiesto debug
├── templates/debug-AndroidManifest.xml
├── README.md
├── .gitignore
└── android/                     # generado por setup:android y versionado (T013)

.gitignore                       # M: excepción para frontend/.env.android (sin secretos)
```

**Structure Decision**: módulo hermano `mobile/` que consume `frontend/dist-android` (D5).

## Flujo de actualización semanal (US4)

1. Integrar las features nuevas del sprint en `frontend/` (con `apiUrl` en cada `fetch`; la guardia lo exige).
2. En `mobile/`: `npm run android` (compila la web en modo `android`, `cap sync` e instala).
3. Si una feature necesita una capacidad nativa nueva (cámara, notificaciones), especificarla como historia propia antes de agregar plugins.

## Complexity Tracking

| Violación | Por qué se necesita | Alternativa más simple descartada porque |
|-----------|---------------------|------------------------------------------|
| Dependencias nuevas (Capacitor) | Sin una capa nativa no existe app Android | Reescribir la app nativa agrega mucho más código y dependencias (D1) |
