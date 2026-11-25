# A mano para Android

App Android de [A mano](https://amano-fiuba.duckdns.org). Empaqueta con [Capacitor](https://capacitorjs.com/) el frontend del repositorio web (`amano`): no hay pantallas duplicadas, cada versión de la web llega a la app recompilando.

En el celular las pantallas se reorganizan para no tener scroll largo: barra inferior, pestañas, alta de gasto grupal en dos pasos y una bienvenida corta. También acepta fotos pesadas y puede recibir notificaciones push. En la web nada de eso cambia.

| Spec | Qué cubre |
|---|---|
| [001-android-app](specs/001-android-app/spec.md) | La app: Capacitor, sesión por cookie, imágenes protegidas, instalación y APK |
| [002-diseno-movil-y-notificaciones](specs/002-diseno-movil-y-notificaciones/spec.md) | Pantallas para el celular, fotos pesadas y notificaciones push |
| [003-actualizacion-sprint-6](specs/003-actualizacion-sprint-6/spec.md) | La app sobre el sprint 6: push de todas las notificaciones de la bandeja, menú "Más" nuevo y repositorio propio |

## Cómo se relaciona con el repositorio web

```
amano/                    ← repositorio web
├── backend/              ← API (incluye los teléfonos para push)
└── frontend/             ← la SPA; también trae el diseño móvil (src/mobile/)

amano-mobile/             ← este repositorio
├── specs/                ← 001, 002, 003
├── scripts/              ← compilan el frontend de amano y preparan android/
├── templates/            ← archivos nativos que se copian a android/
├── capacitor.config.json
└── web/                  ← (opcional) amano como submódulo
```

El código que la app necesita dentro de la web (diseño móvil, fotos, cliente de push, endpoints de teléfonos) vive en `amano`, porque es el mismo frontend y el mismo backend. Este repositorio tiene lo que es solo de Android.

Los scripts buscan el repositorio web en este orden:

1. La variable `AMANO_WEB_DIR`.
2. La carpeta `web/` (submódulo).
3. Una copia al lado: `../amano`.

## Requisitos

- Node.js 22 o superior.
- Android Studio (instala el SDK de Android).
- **Java 21** para Gradle. Si tu Android Studio trae Java 25, instalá el 21 aparte:
  ```bash
  sudo apt install openjdk-21-jdk
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
  export ANDROID_HOME="$HOME/Android/Sdk"
  ```
- Un teléfono con depuración USB (`adb devices` tiene que decir `device`).

## Primera vez

```bash
git clone <url de amano-mobile>
cd amano-mobile
git submodule update --init      # o cloná amano al lado: ../amano
npm install
npm run android                  # compila, genera android/ e instala en el celu
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run android` | Compila la web, prepara `android/`, sincroniza e instala en el teléfono |
| `npm run apk` | Genera `amano.apk` para compartir |
| `npm run sync` | Compila y sincroniza sin instalar |
| `npm run open` | Abre el proyecto en Android Studio |

Para actualizar la app con la última versión de la web:

```bash
git submodule update --remote web   # o git pull dentro de ../amano
npm run apk
```

## Compartir el APK

1. `npm run apk` genera `amano.apk` en la raíz del repo.
2. Subilo a Drive o mandalo por WhatsApp como archivo.
3. Tus compañeros aceptan **instalar apps desconocidas** y, si aparece Play Protect, **Instalar de todas formas**.

Antes de compartirlo:
- El backend de producción tiene que tener el mismo código que el frontend empaquetado.
- Que no exista `frontend/.env.android.local` en el repo web (apunta la app a `localhost`).
- Generá siempre el APK desde la misma compu, así se puede instalar encima de la versión anterior.

## Notificaciones (opcional)

Sin configurar nada, la app funciona completa y las notificaciones se ven en la campanita. Para que además lleguen al celular hacen falta dos archivos de Firebase (pasos en [specs/002 quickstart](specs/002-diseno-movil-y-notificaciones/quickstart.md#2-configurar-firebase-una-vez-por-equipo)):

| Archivo | Dónde va | ¿Secreto? |
|---|---|---|
| `google-services.json` | Raíz de este repositorio | No |
| Cuenta de servicio de Firebase | En base64, en `FIREBASE_CREDENTIALS_BASE64` del `.env` del servidor | **Sí** |

## Probar el diseño móvil en el navegador

En el repo web, con `npm run dev` en `frontend/`, abrí `http://localhost:5173/?mobile=1` en modo celular de las herramientas de desarrollo. `?mobile=0` lo apaga.

## Copia incluida del frontend

Esta versión trae en `web/frontend/` una copia del frontend del repositorio web (sprint 6 + código de la app), así se compila sin tener el repositorio web al lado. Es solo una copia local: no cambia el repositorio web. Para usar otra versión, reemplazá `web/` o usá `AMANO_WEB_DIR`.
