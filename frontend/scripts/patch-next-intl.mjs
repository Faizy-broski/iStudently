import { writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const target = join(__dirname, '../node_modules/next-intl/dist/esm/production/config.js')

if (!existsSync(target)) {
  console.log('patch-next-intl: target not found, skipping')
  process.exit(0)
}

// Replace the throw-stub with a no-op that returns a minimal valid config.
// next-intl/config is only needed for server components using getTranslations().
// This app uses NextIntlClientProvider + useTranslations (client-side only),
// so the server config is never used for rendering — it just must not throw.
const patch = 'async function t(){return{locale:"en",messages:{}}}\nexport{t as default};\n'
writeFileSync(target, patch)
console.log('patch-next-intl: patched production/config.js')
