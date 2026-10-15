import { describe, expect, it } from 'vitest'

import { htmlToText, textToHtml } from './html-text'

describe('htmlToText', () => {
  it('keeps paragraphs, bullets lists, decodes entities, drops scripts', () => {
    const html = '<h2>Terms</h2><p>Hello&nbsp;&amp; welcome</p><ul><li>One</li><li>Two &#1575;</li></ul><script>alert(1)</script><p>End<br>line</p>'
    expect(htmlToText(html)).toBe('Terms\nHello & welcome\n\n• One\n• Two ا\nEnd\nline')
  })
  it('plain text passes through', () => {
    expect(htmlToText('just text')).toBe('just text')
  })
})

describe('textToHtml', () => {
  it('one escaped paragraph per line, blank lines kept', () => {
    expect(textToHtml('a < b\n\nTom & "Jerry"')).toBe('<p>a &lt; b</p><p><br></p><p>Tom &amp; &quot;Jerry&quot;</p>')
  })
  it('round-trips through htmlToText', () => {
    expect(htmlToText(textToHtml('One\nTwo & three'))).toBe('One\nTwo & three')
  })
})
