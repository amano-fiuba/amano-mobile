# Contrato: teléfonos para notificaciones (002)

Ambos endpoints viven bajo `/api/users/**`: requieren la cookie `amano_auth` de una cuenta verificada (regla de web-003). Sin sesión: `401` con el `ProblemDetail` habitual.

## `PUT /api/users/me/push-devices`

Registra el teléfono para la cuenta de la sesión. Idempotente.

```json
{ "token": "<token de FCM>", "platform": "ANDROID" }
```

| Respuesta | Cuándo |
|---|---|
| `204` | Registrado o actualizado. Si el token era de otra cuenta, pasa a esta. |
| `400` `properties.fields.token` = "El token del dispositivo es obligatorio" | Falta o está vacío |
| `400` `properties.fields.token` = "El token del dispositivo no es válido" | Más de 4096 caracteres o con espacios |
| `400` `properties.fields.platform` = "La plataforma no es válida" | Distinta de `ANDROID` (sin `platform` se asume `ANDROID`) |

## `DELETE /api/users/me/push-devices`

Deja de notificar a ese teléfono. Idempotente: un token inexistente o de otra cuenta responde `204` sin cambios.

```json
{ "token": "<token de FCM>" }
```

## Mensaje que recibe el teléfono (FCM HTTP v1)

```json
{
  "message": {
    "token": "<token>",
    "notification": { "title": "Nueva solicitud de amistad", "body": "Bruno Díaz te envió una solicitud de amistad" },
    "data": { "route": "/friends" },
    "android": { "priority": "HIGH", "notification": { "channel_id": "amano", "tag": "friend-request-40" } }
  }
}
```

- `data.route`: pantalla que abre la app al tocar la notificación.
- `channel_id`: canal "Notificaciones de A mano" que crea la app.
- `tag`: una notificación por solicitud; si se repite, reemplaza a la anterior.
