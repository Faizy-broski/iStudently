import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The backend and the web carry copies of the engine (scripts/sync-jahbadh-engine.sh).
const ROOT = resolve(__dirname, '../../../..')
const FILES = ['distribution.ts', 'engine.ts', 'analytics.ts', 'ideas.ts', 'control.ts', 'timer.ts', 'index.ts']

describe('jahbadh engine copies', () => {
  for (const dest of ['backend/src/lib/jahbadh', 'frontend/src/lib/jahbadh']) {
    for (const file of FILES) {
      it(`${dest}/${file} matches the source`, () => {
        const source = readFileSync(resolve(__dirname, file), 'utf8')
        const copy = readFileSync(resolve(ROOT, dest, file), 'utf8')
        expect(copy.split('\n').slice(1).join('\n'), 'run: sh packages/shared-utils/scripts/sync-jahbadh-engine.sh').toBe(source)
      })
    }
  }
})
