jest.mock('../config/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }))

import { imageBytesMatch } from './media-upload.controller'

const b = (hex: string) => Buffer.from(hex.padEnd(32, '0'), 'hex')

describe('imageBytesMatch', () => {
  it('accepts real image headers', () => {
    expect(imageBytesMatch('image/png', b('89504e470d0a1a0a'))).toBe(true)
    expect(imageBytesMatch('image/jpeg', b('ffd8ffe0'))).toBe(true)
    expect(imageBytesMatch('image/gif', Buffer.from('GIF89a......'))).toBe(true)
    expect(imageBytesMatch('image/webp', Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 '))).toBe(true)
    expect(imageBytesMatch('image/svg+xml', Buffer.from('  <svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(true)
  })

  it('rejects content that does not match the claimed type', () => {
    expect(imageBytesMatch('image/png', Buffer.from('<html><script>alert(1)</script></html>'))).toBe(false)
    expect(imageBytesMatch('image/jpeg', b('89504e47'))).toBe(false)
    expect(imageBytesMatch('image/svg+xml', Buffer.from('<html><script>x</script>'))).toBe(false)
  })

  it('rejects unknown types and tiny files', () => {
    expect(imageBytesMatch('text/html', Buffer.from('<html></html>'))).toBe(false)
    expect(imageBytesMatch('image/png', Buffer.from('ab'))).toBe(false)
  })
})

describe('uploadLibraryFile', () => {
  const { supabase } = jest.requireMock('../config/supabase')
  const { uploadLibraryFile } = jest.requireActual('./media-upload.controller')
  const upload = jest.fn().mockResolvedValue({ error: null })
  beforeEach(() => {
    upload.mockClear()
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) })
  })
  const res = () => {
    const r: any = {}
    r.status = jest.fn(() => r)
    r.json = jest.fn(() => r)
    return r
  }
  const png = Buffer.concat([b('89504e470d0a1a0a'), Buffer.alloc(32)])
  const call = async (file: any, body: any) => {
    const r = res()
    await uploadLibraryFile({ profile: { school_id: 's1' }, file, body } as any, r)
    return r
  }

  it('stores a cover under covers/', async () => {
    const r = await call({ mimetype: 'image/png', size: png.length, buffer: png, originalname: 'c.png' }, { kind: 'cover' })
    expect(r.status).toHaveBeenCalledWith(201)
    expect(upload.mock.calls[0][0]).toMatch(/^s1\/covers\/[0-9a-f-]+\.png$/)
  })

  it('rejects a cover over 5 MB and a fake image', async () => {
    expect((await call({ mimetype: 'image/png', size: 6 * 1024 * 1024, buffer: png }, { kind: 'cover' })).status).toHaveBeenCalledWith(413)
    expect((await call({ mimetype: 'image/png', size: 20, buffer: Buffer.from('<html><script>x</script>') }, { kind: 'cover' })).status).toHaveBeenCalledWith(415)
    expect(upload).not.toHaveBeenCalled()
  })

  it('files documents by category and ignores a non-uuid category', async () => {
    const pdf = { mimetype: 'application/pdf', size: 1000, buffer: Buffer.from('%PDF-1.4'), originalname: 'a.pdf' }
    await call(pdf, { kind: 'document', category_id: '11111111-2222-3333-4444-555555555555' })
    await call(pdf, { kind: 'document', category_id: '../../etc' })
    expect(upload.mock.calls[0][0]).toMatch(/^s1\/documents\/11111111-2222-3333-4444-555555555555\/[0-9a-f-]+\.pdf$/)
    expect(upload.mock.calls[1][0]).toMatch(/^s1\/documents\/uncategorized\//)
  })

  it('rejects HTML documents', async () => {
    expect((await call({ mimetype: 'text/html', size: 10, buffer: Buffer.from('<html>') }, { kind: 'document' })).status).toHaveBeenCalledWith(415)
  })
})
