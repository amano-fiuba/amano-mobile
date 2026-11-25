// Compila el frontend del repositorio web en modo `android` (mobile 001) y deja
// el resultado en `www/`, que es lo que empaqueta Capacitor. Le avisa si
// Firebase está configurado (mobile 002): sin google-services.json la app no
// pide el token de notificaciones, porque Firebase no está inicializado y el
// pedido cerraría la app.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { root, webDir } from './web-dir.mjs'

const web = webDir()
const frontend = join(web, 'frontend')
const pushEnabled = existsSync(join(root, 'google-services.json'))

console.log(`Frontend: ${frontend}`)
if (!existsSync(join(frontend, 'node_modules'))) {
  execSync('npm ci', { cwd: frontend, stdio: 'inherit' })
}
// Igual que `npm run build:android` del frontend, pero la salida va a www/.
execSync(`npx vite build --mode android --outDir "${join(root, 'www')}" --emptyOutDir`, {
  cwd: frontend,
  stdio: 'inherit',
  env: { ...process.env, VITE_PUSH_ENABLED: String(pushEnabled) },
})
console.log(pushEnabled ? 'Notificaciones: activadas' : 'Notificaciones: desactivadas (falta google-services.json)')
