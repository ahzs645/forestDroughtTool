import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, '../docs')
rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.json')], { stdio: 'inherit' })
function rewriteImports(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) rewriteImports(path)
    else if (entry.name.endsWith('.js')) {
      const source = readFileSync(path, 'utf8')
      writeFileSync(path, source.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, (_, start, target, end) => `${start}${target.endsWith('.js') ? target : `${target}.js`}${end}`))
    }
  }
}
rewriteImports(join(output, 'lib'))
cpSync(join(root, 'static'), output, { recursive: true })
writeFileSync(join(output, '.nojekyll'), '')
console.log('Built static browser application in docs/. No server or runtime dependencies.')
