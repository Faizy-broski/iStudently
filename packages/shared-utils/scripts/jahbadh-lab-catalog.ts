/**
 * Builds the Jahbadh Lab `catalog.json` from the client's unpacked lab folder(s).
 *   npx tsx packages/shared-utils/scripts/jahbadh-lab-catalog.ts <labDir> [<labDir2> ...] [--out file] [--generated-at ISO]
 *
 * - Every `<CODE>.html` in the folders is one experiment; `index.html` (the lab's own launcher) is read
 *   as text for the catalog: names in ar/en/fr, groups, subjects and school stages.
 * - Several folders are merged (the client ships the lab in parts); a code found twice is reported and
 *   the first folder wins.
 * - Files are only READ AS TEXT, never executed. Default output: `<first labDir>/catalog.json`.
 * - Everything except `generated_at` is deterministic; pass --generated-at (or SOURCE_DATE_EPOCH) to
 *   make that stable too.
 * The coverage report goes to stderr. Exit code 1 only when nothing could be built.
 * Hosting: docs/jahbadh/lab-hosting.md.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildLabCatalog, parseLabIndex, type LabCatalogReport, type LabFileInput } from '../src/jahbadh/lab-catalog'

function parseArgs(argv: string[]) {
  const dirs: string[] = []
  let out: string | null = null
  let generatedAt: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') out = argv[++i] ?? null
    else if (a === '--generated-at') generatedAt = argv[++i] ?? null
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`)
    else dirs.push(resolve(a))
  }
  return { dirs, out, generatedAt }
}

function printReport(r: LabCatalogReport, out: string) {
  const list = (label: string, codes: string[]) => {
    if (codes.length === 0) return
    const shown = codes.slice(0, 40).join(', ')
    console.error(`  ${label} (${codes.length}): ${shown}${codes.length > 40 ? ', …' : ''}`)
  }
  console.error(`Jahbadh Lab catalog: ${r.total} experiments -> ${out}`)
  console.error('  by subject:', JSON.stringify(r.bySubject))
  console.error(`  groups used: ${Object.keys(r.byGroup).length}`)
  list('named from the file (not in the index)', r.scraped)
  list('NO NAME, code used', r.unnamed)
  list('name missing in one language', r.partialNames)
  list('files without an index entry', r.filesWithoutIndexEntry)
  list('index entries without a file (left out)', r.indexEntriesWithoutFile)
  list('duplicate codes (first folder wins)', r.duplicates)
  list('skipped file names (unsafe for a URL)', r.skippedFiles)
  list('empty groups (left out)', r.emptyGroups)
  list('unknown level letters (dropped)', r.badLevels)
}

function main() {
  const { dirs, out, generatedAt } = parseArgs(process.argv.slice(2))
  if (dirs.length === 0) {
    console.error('Usage: jahbadh-lab-catalog.ts <labDir> [<labDir2> ...] [--out file] [--generated-at ISO]')
    process.exit(1)
  }
  const files: LabFileInput[] = []
  let indexHtml: string | null = null
  for (const dir of dirs) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`Not a folder: ${dir}`)
    for (const name of readdirSync(dir).sort()) {
      if (!name.toLowerCase().endsWith('.html')) continue
      const code = name.slice(0, -'.html'.length)
      const path = join(dir, name)
      if (code === 'index') {
        if (indexHtml === null) indexHtml = readFileSync(path, 'utf8')
        continue
      }
      files.push({ code, source: dir, read: () => readFileSync(path, 'utf8') })
    }
  }
  const index = indexHtml === null ? null : parseLabIndex(indexHtml)
  if (index === null) console.error('No index.html found: names are scraped from the files and groups come from the file names.')
  const stamp = generatedAt ?? (process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : new Date().toISOString())
  const { catalog, report } = buildLabCatalog({ index, files, generatedAt: stamp })
  if (catalog.count === 0) {
    console.error('No experiments found.')
    process.exit(1)
  }
  const target = resolve(out ?? join(dirs[0], 'catalog.json'))
  writeFileSync(target, JSON.stringify(catalog) + '\n')
  printReport(report, target)
}

main()
