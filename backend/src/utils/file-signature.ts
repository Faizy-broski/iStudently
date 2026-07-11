// Minimal, dependency-free magic-byte verification for the fixed, small
// allowlist of file types the GrievancePortal accepts. A client can lie about
// a file's declared MIME type (e.g. rename a script to "report.pdf"), so the
// server checks the actual leading bytes rather than trusting `file.mimetype`.

type SignatureCheck = (buf: Buffer) => boolean

const SIGNATURES: Record<string, SignatureCheck> = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'application/pdf': (b) =>
    b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  // Legacy .doc/.xls (OLE Compound File)
  'application/msword': (b) => isOle(b),
  'application/vnd.ms-excel': (b) => isOle(b),
  // .docx/.xlsx are ZIP containers
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => isZip(b),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => isZip(b),
}

function isOle(b: Buffer): boolean {
  return (
    b.length >= 8 &&
    b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 &&
    b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1
  )
}

function isZip(b: Buffer): boolean {
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)
}

/**
 * Returns true only if `declaredMimeType` is a known type in this module's
 * allowlist AND the file's actual bytes match that type's signature. Unknown
 * MIME types are rejected outright (callers should already be filtering
 * against grievance_settings.allowed_file_types before calling this).
 */
export function matchesFileSignature(buffer: Buffer, declaredMimeType: string): boolean {
  const check = SIGNATURES[declaredMimeType]
  if (!check) return false
  return check(buffer)
}
