// Image and attachment uploads through the API (never straight to Supabase Storage).
// backend/src/controllers/media-upload.controller.ts uploadImageAsset: listed image types only,
// bytes must match the type, max 25 MB, stored in the public `school-assets` bucket.
import type { ApiClient } from '../client'
import type { UploadFile } from '../types'

export interface UploadedImage {
  url: string
  mime_type: string
  size: number
  path: string
}

export interface UploadedAttachment extends UploadedImage {
  name: string
}

export function mediaApi(api: ApiClient) {
  return {
    /** Audio/video recordings (webm/ogg/mp4/wav), max 50 MB (web: uploadMediaRecording). */
    uploadRecording: (file: UploadFile) => {
      const form = new FormData()
      form.append('file', file as Blob)
      return api.post<{ url: string }>('/media/upload', form, { timeout: 120_000 })
    },
    uploadImage: (file: UploadFile) => {
      const form = new FormData()
      form.append('file', file as Blob)
      return api.post<UploadedImage>('/media/upload-image', form, { timeout: 120_000 })
    },
    /** Documents and images (PDF, Office, txt/csv, zip, jpg/png/gif/webp), max 15 MB, stored under the caller's school. */
    uploadAttachment: (file: UploadFile, campusId?: string) => {
      const form = new FormData()
      form.append('file', file as Blob)
      if (campusId) form.append('campus_id', campusId)
      return api.post<UploadedAttachment>('/media/upload-attachment', form, { timeout: 120_000 })
    },
    /** Library cover (JPEG/PNG/WebP, 5 MB) or digital document (PDF/Office/txt/images, 50 MB), stored like the web's book uploads. */
    uploadLibraryFile: (file: UploadFile, kind: 'cover' | 'document', categoryId?: string) => {
      const form = new FormData()
      form.append('file', file as Blob)
      form.append('kind', kind)
      if (categoryId) form.append('category_id', categoryId)
      return api.post<UploadedAttachment>('/media/upload-library-file', form, { timeout: 300_000 })
    },
  }
}
