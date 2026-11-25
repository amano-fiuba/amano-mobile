// Prepara y sincroniza el proyecto nativo `android/` (amano-mobile specs/001-android-app,
// amano-mobile 002). Idempotente: se corre en cada `npm run sync` /
// `npm run android`, así un `git pull` con cambios nativos se aplica solo.
//
// 1. Genera `android/` la primera vez.
// 2. Manifiesto de depuración: HTTP local permitido solo en debug (mobile 001 D9).
// 3. Cámara opcional para la foto de perfil (mobile 002).
// 4. Notificaciones (mobile 002 US4): google-services.json de Firebase, ícono y canal
//    por defecto de las notificaciones.
// 5. `cap sync android`.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(root, 'android', 'app')
const run = (command) => execSync(command, { cwd: root, stdio: 'inherit' })

// Gradle de Android necesita Java 21: con Java 25 falla con
// "Unsupported class file major version 69".
try {
  const java = process.env.JAVA_HOME ? `"${join(process.env.JAVA_HOME, 'bin', 'java')}"` : 'java'
  const out = execSync(`${java} -version 2>&1`, { encoding: 'utf8' })
  const major = Number(out.match(/version "(\d+)/)?.[1])
  if (major && major !== 21 && major !== 17) {
    console.warn(
      `\n⚠  Gradle va a usar Java ${major}; Android necesita Java 21.` +
        '\n   sudo apt install openjdk-21-jdk' +
        '\n   export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64\n',
    )
  }
} catch {
  console.warn('\n⚠  No encontré Java. Android necesita Java 21 (JAVA_HOME).\n')
}

if (!existsSync(join(root, 'android'))) {
  run('npx cap add android')
}

// 2. Depuración
const debugDir = join(app, 'src', 'debug')
mkdirSync(debugDir, { recursive: true })
copyFileSync(join(root, 'templates', 'debug-AndroidManifest.xml'), join(debugDir, 'AndroidManifest.xml'))

// 3 y 4. Manifiesto principal
const manifestPath = join(app, 'src', 'main', 'AndroidManifest.xml')
let manifest = readFileSync(manifestPath, 'utf8')

const camera = '<uses-feature android:name="android.hardware.camera" android:required="false" />'
if (!manifest.includes('android.hardware.camera')) {
  manifest = manifest.replace('</manifest>', `    ${camera}\n</manifest>`)
}

const notificationMeta = [
  '<meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_amano" />',
  '<meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/amano_notification" />',
  '<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="amano" />',
]
for (const line of notificationMeta) {
  const name = line.match(/android:name="([^"]+)"/)[1]
  if (!manifest.includes(name)) {
    manifest = manifest.replace('</application>', `        ${line}\n    </application>`)
  }
}
writeFileSync(manifestPath, manifest)

// Ícono (silueta blanca) y color de acento de las notificaciones
const drawable = join(app, 'src', 'main', 'res', 'drawable')
mkdirSync(drawable, { recursive: true })
copyFileSync(join(root, 'templates', 'ic_stat_amano.xml'), join(drawable, 'ic_stat_amano.xml'))
const values = join(app, 'src', 'main', 'res', 'values')
mkdirSync(values, { recursive: true })
writeFileSync(
  join(values, 'amano_notification.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="amano_notification">#0F6E6E</color>\n</resources>\n',
)

// Firebase: sin google-services.json la app funciona igual, pero no recibe
// notificaciones (y pedir el token haría fallar el registro).
const firebaseConfig = join(root, 'google-services.json')
if (existsSync(firebaseConfig)) {
  copyFileSync(firebaseConfig, join(app, 'google-services.json'))
} else {
  console.warn(
    '\n⚠  Falta mobile/google-services.json: la app no va a recibir notificaciones.' +
      '\n   Ver mobile/README.md, sección "Notificaciones".\n',
  )
}

// 5. Sincronizar
run('npx cap sync android')
console.log('\nListo. Conectá el teléfono y corré: npm run android')
