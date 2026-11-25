# Contrato: mensaje push (003)

Reemplaza la sección "Mensaje que recibe el teléfono" de [002](../../002-diseno-movil-y-notificaciones/contracts/push-devices-api.md). Los endpoints de teléfonos no cambian.

```json
{
  "message": {
    "token": "<token>",
    "notification": { "title": "<title de la notificación>", "body": "<message de la notificación>" },
    "data": { "route": "/groups/3/debts?debt=9", "notificationId": "41" },
    "android": { "priority": "HIGH", "notification": { "channel_id": "amano", "tag": "notification-41" } }
  }
}
```

| `target.kind` en la bandeja | `data.route` |
|---|---|
| `GROUP` con `groupId` | `/groups/{groupId}` |
| `DEBT` con `groupId` | `/groups/{groupId}/debts?debt={debtId}` |
| `DEBT` sin `groupId` | `/activity?debt={debtId}` |
| `FRIEND_REQUEST` | `/friends` |
| cualquier otro o incompleto | `/notifications` |

Al tocar: `PATCH /api/v1/notifications/{notificationId}/read` y navegación a `data.route`.
