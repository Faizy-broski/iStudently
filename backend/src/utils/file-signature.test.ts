import { matchesFileSignature } from './file-signature'

// Voice notes recorded on phones (inspection evidence): m4a ("ftyp" box) and wav (RIFF/WAVE).
describe('matchesFileSignature (phone audio)', () => {
  const m4a = Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20])
  const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WAVEfmt ')])
  it('accepts real m4a and wav bytes', () => {
    expect(matchesFileSignature(m4a, 'audio/mp4')).toBe(true)
    expect(matchesFileSignature(m4a, 'audio/x-m4a')).toBe(true)
    expect(matchesFileSignature(wav, 'audio/wav')).toBe(true)
  })
  it('rejects bytes that do not match the declared type', () => {
    expect(matchesFileSignature(wav, 'audio/mp4')).toBe(false)
    expect(matchesFileSignature(m4a, 'audio/wav')).toBe(false)
    expect(matchesFileSignature(Buffer.from('<script>'), 'audio/wav')).toBe(false)
  })
})
