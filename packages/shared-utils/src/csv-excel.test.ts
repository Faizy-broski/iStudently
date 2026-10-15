import { describe, expect, it } from 'vitest'

import { toExcelXml } from './csv'

describe('toExcelXml', () => {
  it('writes a header row and typed cells, escaping markup', () => {
    const xml = toExcelXml('Grievances', ['Number', 'Title'], [[12, 'A <b> & "c"'], ['x', null]])
    expect(xml).toContain('<Worksheet ss:Name="Grievances">')
    expect(xml).toContain('<Cell><Data ss:Type="Number">12</Data></Cell>')
    expect(xml).toContain('A &lt;b&gt; &amp; &quot;c&quot;')
    expect(xml).toContain('<Cell><Data ss:Type="String"></Data></Cell>')
  })
  it('keeps sheet names within Excel\'s 31-character limit', () => {
    expect(toExcelXml('x'.repeat(40), [], [])).toContain(`ss:Name="${'x'.repeat(31)}"`)
  })
})
