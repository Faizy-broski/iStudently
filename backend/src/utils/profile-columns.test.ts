import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Responses must never include whole profile rows (TOTP secret, recovery codes, encrypted password).
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : []
  })
}

describe('profile selects', () => {
  it('no service, controller or route embeds profiles(*)', () => {
    const root = join(__dirname, '..')
    const offenders = ['services', 'controllers', 'routes']
      .flatMap((d) => files(join(root, d)))
      .filter((f) => /profiles?\s*\(\s*\*\s*\)/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(root, 'src'))
    expect(offenders).toEqual([])
  })
})
