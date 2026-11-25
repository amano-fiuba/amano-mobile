# Implementation Plan: App Android completa (002)

**Branch**: `feat/android-app` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

## Summary

Reaplicar 001 sobre `main`, reorganizar las pantallas para el celular sin tocar la web, achicar fotos en el teléfono y sumar notificaciones push con Firebase Cloud Messaging. El backend agrega una tabla, dos endpoints y un emisor FCM propio; el frontend agrega un puente al plugin nativo; `mobile/` suma el plugin y la configuración de Firebase.

## Technical Context

- **Backend**: Java 25 + Spring Boot 4.1. **Sin dependencias nuevas**: FCM HTTP v1 con `RestClient` y la firma RS256 de `jjwt` (ya en el `pom.xml`).
- **Frontend**: React 19 + Vite. **Sin dependencias nuevas**: el plugin nativo se usa por el puente `window.Capacitor` (como `ApiImage`).
- **App**: Capacitor 8 + `@capacitor/push-notifications` 8 (solo en `mobile/package.json`).
- **Storage**: PostgreSQL, una tabla nueva (`push_devices`, V39).
- **Testing**: JUnit + Mockito + `MockRestServiceServer` + Testcontainers; Vitest + Testing Library.

## Decisiones (research)

| # | Decisión | Por qué | Alternativas descartadas |
|---|---|---|---|
| D1 | Diseño móvil por `MobileTabs`/`MobileTab`: en la web devuelven el mismo HTML | Una sola base de código; la web no cambia y sus pruebas siguen iguales | Pantallas duplicadas para el celular (doble mantenimiento) |
| D2 | Fotos achicadas en el navegador (`createImageBitmap` + canvas → JPG) | Sin cambios en backend ni base; subidas más rápidas con datos móviles | Subir el límite del backend (más espacio en la base y transferencias lentas) |
| D3 | FCM HTTP v1 llamado a mano (JWT RS256 → OAuth → `messages:send`) | Cero dependencias nuevas; el SDK de Firebase Admin suma decenas de librerías | Firebase Admin SDK; polling desde la app (no funciona con la app cerrada) |
| D4 | Envío con `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` | Una solicitud que falla nunca notifica; nadie espera a Firebase | Llamar al envío dentro de `FriendshipRequestService.send` |
| D5 | Credenciales en `FIREBASE_CREDENTIALS_BASE64` (o `_FILE`) | Una variable más en el `.env` de la Raspberry, sin montar archivos | Montar un archivo con Docker (si falta, Docker crea un directorio) |
| D6 | La app solo pide el token si se compiló con `google-services.json` (`VITE_PUSH_ENABLED`) | Sin Firebase inicializado, pedir el token cierra la app | Detectarlo en tiempo de ejecución (el plugin no lo expone) |
| D7 | Un token pertenece a una sola cuenta y se borra al cerrar sesión | Un teléfono compartido nunca muestra avisos de otra cuenta | Varios dueños por token |
| D8 | Canal Android `amano` creado por la app; ícono monocromo propio | Android 8+ exige canal; el ícono de la app se vería como un cuadrado blanco | Canal por defecto de FCM ("Miscellaneous") |

## Estructura

```
backend/src/main/java/com/amano/backend/
├── friendship/FriendshipRequestCreatedEvent.java   (nuevo; lo publica FriendshipRequestService)
└── push/                                            (nuevo)
    ├── PushDevice, PushDeviceRepository, PushPlatform, PushDeviceRequest
    ├── PushDeviceService, PushDeviceController      (PUT/DELETE /api/users/me/push-devices)
    ├── PushMessage, PushSender, DisabledPushSender
    ├── FirebaseServiceAccount, FcmPushSender, PushConfig
    ├── PushNotificationService                      (@Async, borra tokens muertos)
    └── FriendshipRequestPushListener                (AFTER_COMMIT)
backend/src/main/resources/db/migration/V39__create_push_devices.sql

frontend/src/
├── api/apiBase.js, api/apiImage.js, api/pushClient.js
├── components/ApiImage.jsx
├── utils/imagePrep.js
└── mobile/
    ├── mobileLayout.js, mobile.scss
    ├── MobileTabs.jsx, MobileTabBar.jsx, MobileWelcome.jsx
    └── nativePush.js, PushNotifications.jsx

mobile/
├── package.json, capacitor.config.json
├── scripts/build-web.mjs, scripts/setup-android.mjs
├── templates/debug-AndroidManifest.xml, templates/ic_stat_amano.xml
└── google-services.json        (lo agrega cada equipo; ver quickstart §2)
```

## Constitution Check

- Sin secretos en el repositorio: la cuenta de servicio va en `.env`; `google-services.json` es configuración pública del cliente (Firebase lo documenta así), pero queda fuera de `android/` generado.
- Logs sin datos sensibles (FR-019): solo códigos HTTP y nombres de excepción.
- Pruebas sin servicios externos: FCM se prueba contra `MockRestServiceServer`; el emisor real se desactiva sin credenciales.
