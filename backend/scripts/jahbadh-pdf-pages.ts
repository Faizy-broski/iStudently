// Renders an HTML file with the platform's headless Chromium and prints the PDF page count
// (used by the Jahbadh one-page test: Jest cannot load puppeteer, so it runs this in a child process).
//   npx tsx scripts/jahbadh-pdf-pages.ts <file.html>
import { readFileSync } from 'node:fs'

import { closeSharedPdfBrowser, renderHtmlToPdf } from '../src/utils/html-pdf.util'

async function main() {
  const html = readFileSync(process.argv[2], 'utf8')
  const pdf = await renderHtmlToPdf(html, { margin: { top: '0', bottom: '0' } })
  console.log((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length)
  await closeSharedPdfBrowser()
}
main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(2)
})
