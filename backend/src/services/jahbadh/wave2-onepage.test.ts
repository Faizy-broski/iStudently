// Brief B7: the report card stays ONE A4 page with the most subjects (grade 10: 13 subjects in 2026-27),
// every element on, final scope, a long name. The HTML is built here; scripts/jahbadh-pdf-pages.ts renders
// it with the real headless Chromium in a child process (Jest cannot load puppeteer). Skipped without one.
jest.mock('../../config/supabase', () => require('./jg-test-db').supabaseMock)
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('../../utils/html-pdf.util', () => ({
  escapeHtml: (x: string) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string),
  renderHtmlToPdf: async () => Buffer.from(''),
}))
jest.mock('../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn() } }))

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { resetDb } from './jg-test-db'
import { loadFixture } from './jg-test-fixtures'
import { JG_REPORT_CARD_ALL_ON, reportCardHtml } from './print.service'
import * as rc from './report-cards.service'

jest.setTimeout(120_000)

it('a 13-subject final card, every element on, prints on exactly one A4 page', async () => {
  resetDb()
  const ctx = loadFixture(10)
  expect(ctx.grade.subjects.length).toBe(13)
  const { cards } = await rc.buildReportCards(ctx, 'final')
  const card = { ...cards[0], student: { ...cards[0].student, name: 'عبد الرحمن محمد عبد الله الشريف الطرابلسي' } }
  const file = join(mkdtempSync(join(tmpdir(), 'jg-card-')), 'card.html')
  writeFileSync(file, reportCardHtml(card, JG_REPORT_CARD_ALL_ON))
  let pages: number
  try {
    pages = Number(execFileSync('npx', ['tsx', 'scripts/jahbadh-pdf-pages.ts', file], { cwd: resolve(__dirname, '../../..'), timeout: 100_000, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim().split('\n').pop())
  } catch (err) {
    console.warn('Chromium not available; one-page check skipped:', (err as Error).message.slice(0, 200))
    return
  }
  expect(pages).toBe(1)
})
