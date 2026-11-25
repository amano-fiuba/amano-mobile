# Implementation Plan: 003 — App Android sobre el sprint 6

**Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

## Summary

Mezcla de 3 vías: base `main` (= sprint 5), un lado el sprint 6 y el otro la app (001 + 002). Seis conflictos resueltos; el push se engancha en la entrega de la bandeja de web-035 y el aviso propio de amistad se elimina. La app se mueve a un repositorio propio.

## Conflictos de la mezcla

| Archivo | Resolución |
|---|---|
| `FriendshipRequestService.java` + test | Versión del sprint 6 (ya publica el evento de la bandeja); se borran `FriendshipRequestCreatedEvent` y `FriendshipRequestPushListener` |
| `NotificationsMenu.jsx` | Versión del sprint 6 (popover nuevo; no muestra avatares, no necesita `ApiImage`) |
| `AppHeader.jsx` | Sprint 6 (tema y cerrar sesión en la barra) + variante móvil de 002 |
| `detalles.scss` | Listas del sprint 6 + clases de la app en `$quietos` |
| `README.md` | Sprint 6 + fila "App Android" y enlace a la app |

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | Push desde `NotificationDeliveryService`, justo después de guardar en la bandeja | Una sola fuente de verdad: lo que está en la bandeja es lo que llega al celular, con las mismas preferencias |
| D2 | La ruta se calcula en el backend (`PushMessage.routeFor`) replicando `notificationTarget.js` | El aviso tiene que abrir la app en el destino aunque la app esté cerrada, sin pedir la notificación antes |
| D3 | `notificationId` en el push y `markRead` al tocar | Tocar en el celular equivale a un clic en la campana (web-035 FR-016) |
| D4 | Si `markRead` falla, se navega igual | En el celular no hay "quedarse en el lugar": la app recién se abre; la notificación queda sin leer y se puede abrir desde la bandeja |
| D5 | Repositorio móvil con submódulo opcional y salida a `www/` | El repositorio web no cambia de estructura; el móvil no copia código de la web |

## Cambios en el repositorio web

```
backend/.../notification/NotificationDeliveryService.java   + PushNotificationService (después de guardar)
backend/.../push/PushMessage.java                            forNotification(), routeFor(), notificationId
backend/.../push/FcmPushSender.java                          data.notificationId
backend/.../db/migration/V40__create_push_devices.sql        (antes V39)
frontend/src/api/notificationsClient.js                      apiUrl
frontend/src/mobile/PushNotifications.jsx, nativePush.js     markRead al tocar
frontend/src/mobile/MobileTabBar.jsx, mobileLayout.js        menú "Más" y /notifications
frontend/src/mobile/mobile.scss                              pie del menú "Más"
− mobile/, specs/019-android-app, specs/035-android-app      (pasan al repositorio móvil)
```

## Repositorio móvil

```
specs/001…003, README.md
package.json, capacitor.config.json (webDir: www)
scripts/web-dir.mjs        busca el repositorio web
scripts/build-web.mjs      vite build --mode android --outDir www
scripts/setup-android.mjs  android/, manifiestos, ícono, Firebase, aviso de Java 21
templates/
```
