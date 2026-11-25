// Dónde está el repositorio web (amano), que tiene el frontend que empaqueta
// la app. En orden:
// 1. La variable AMANO_WEB_DIR.
// 2. El submódulo `web/` de este repositorio (git submodule update --init).
// 3. Una copia hermana: ../amano.
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function webDir() {
  const candidates = [
    process.env.AMANO_WEB_DIR && resolve(process.env.AMANO_WEB_DIR),
    join(root, 'web'),
    resolve(root, '..', 'amano'),
  ].filter(Boolean)
  const found = candidates.find((dir) => existsSync(join(dir, 'frontend', 'package.json')))
  if (!found) {
    console.error(
      '\n✖ No encuentro el repositorio web (amano).\n' +
        '  Opciones:\n' +
        '  - git submodule update --init         (usa la carpeta web/)\n' +
        '  - clonar amano al lado de este repo   (../amano)\n' +
        '  - AMANO_WEB_DIR=/ruta/a/amano npm run android\n',
    )
    process.exit(1)
  }
  return found
}
