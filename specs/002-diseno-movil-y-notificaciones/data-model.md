# Data Model: 002

## Tabla nueva `push_devices` (migración `V40__create_push_devices.sql` (V39 en la primera versión; ver 003))

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | `BIGSERIAL` | PK |
| `user_id` | `BIGINT` | FK `users(id)` `ON DELETE CASCADE`, índice `ix_push_devices_user` |
| `token` | `VARCHAR(4096)` | `UNIQUE` (`uq_push_devices_token`): un teléfono, una cuenta |
| `platform` | `VARCHAR(10)` | `CHECK (platform IN ('ANDROID'))` |
| `created_at` | `TIMESTAMPTZ` | alta |
| `last_seen_at` | `TIMESTAMPTZ` | último registro desde la app |

Sin cambios en tablas existentes y sin backfill.

## Ciclo de vida de un token

```
(app con permiso) ── PUT ──► registrado (cuenta A)
        │                         │
        │  otra cuenta hace PUT   ├──► registrado (cuenta B)
        │                         │
        └─ logout: DELETE ────────┴──► borrado
FCM responde UNREGISTERED ───────────► borrado
```
