import type { UploadFile } from '@studently/api-client'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

export type PickResult = { ok: true; file: UploadFile & { uri: string } } | { ok: false; reason: 'cancelled' | 'permission' }

/**
 * Pick an image from the library (or take one with the camera), scale it down to `maxDimension` and re-encode it, so uploads stay
 * small on mobile data. PNG keeps transparency (logos); photos become JPEG.
 */
export async function pickImage({ maxDimension = 1024, keepTransparency = true, source = 'library' }: { maxDimension?: number; keepTransparency?: boolean; source?: 'library' | 'camera' } = {}): Promise<PickResult> {
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return { ok: false, reason: 'permission' }

  const res = source === 'camera' ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
  if (res.canceled || !res.assets[0]) return { ok: false, reason: 'cancelled' }
  const asset = res.assets[0]

  const isPng = keepTransparency && (asset.mimeType === 'image/png' || asset.uri.toLowerCase().endsWith('.png'))
  const largest = Math.max(asset.width ?? 0, asset.height ?? 0)

  const ctx = ImageManipulator.manipulate(asset.uri)
  if (largest > maxDimension) {
    ctx.resize(asset.width >= asset.height ? { width: maxDimension } : { height: maxDimension })
  }
  const rendered = await ctx.renderAsync()
  const saved = await rendered.saveAsync({ format: isPng ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.8 })

  const ext = isPng ? 'png' : 'jpg'
  return {
    ok: true,
    file: { uri: saved.uri, name: `image-${Date.now()}.${ext}`, type: isPng ? 'image/png' : 'image/jpeg' },
  }
}

export type PickedDocument = { uri: string; name: string; type: string; size?: number }

/** Pick one or more files of any type (attachments). Returns [] when cancelled. */
export async function pickDocuments({ multiple = true }: { multiple?: boolean } = {}): Promise<PickedDocument[]> {
  const DocumentPicker = await import('expo-document-picker')
  const res = await DocumentPicker.getDocumentAsync({ multiple, copyToCacheDirectory: true })
  if (res.canceled) return []
  return res.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', size: a.size ?? undefined }))
}

export type PickedMedia = { ok: true; file: { uri: string; name: string; type: string } } | { ok: false; name: string; reason: 'unsupported' }

/**
 * Pick several photos and/or videos (Fina). Photos are re-encoded to JPEG (HEIC included) and
 * scaled to `maxDimension`; videos pass through only as MP4/WebM, the formats the server accepts.
 * Returns [] when cancelled or permission is refused.
 */
export async function pickMedia({ maxDimension = 2048 } = {}): Promise<PickedMedia[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return []
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 1 })
  if (res.canceled) return []
  const out: PickedMedia[] = []
  for (const asset of res.assets) {
    const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'file'
    if (asset.type === 'video') {
      const type = asset.mimeType ?? (name.toLowerCase().endsWith('.webm') ? 'video/webm' : name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : '')
      if (type !== 'video/mp4' && type !== 'video/webm') out.push({ ok: false, name, reason: 'unsupported' })
      else out.push({ ok: true, file: { uri: asset.uri, name, type } })
      continue
    }
    const ctx = ImageManipulator.manipulate(asset.uri)
    const largest = Math.max(asset.width ?? 0, asset.height ?? 0)
    if (largest > maxDimension) ctx.resize(asset.width >= asset.height ? { width: maxDimension } : { height: maxDimension })
    const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85 })
    out.push({ ok: true, file: { uri: saved.uri, name: `photo-${Date.now()}-${out.length}.jpg`, type: 'image/jpeg' } })
  }
  return out
}

/** Pick an image and return it as a `data:` URI (for print-only use such as a certificate frame; never uploaded). */
export async function pickImageDataUri({ maxDimension = 2000 } = {}): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
  if (res.canceled || !res.assets[0]) return null
  const asset = res.assets[0]
  const isPng = asset.mimeType === 'image/png' || asset.uri.toLowerCase().endsWith('.png')
  const ctx = ImageManipulator.manipulate(asset.uri)
  if (Math.max(asset.width ?? 0, asset.height ?? 0) > maxDimension) ctx.resize(asset.width >= asset.height ? { width: maxDimension } : { height: maxDimension })
  const saved = await (await ctx.renderAsync()).saveAsync({ format: isPng ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.85, base64: true })
  return saved.base64 ? `data:image/${isPng ? 'png' : 'jpeg'};base64,${saved.base64}` : null
}
