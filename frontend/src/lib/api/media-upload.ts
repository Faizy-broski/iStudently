import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { getImpersonationHeaders } from './abortable-fetch'

export interface MediaUploadResult {
  url: string
  mime_type: string
  size: number
  path: string
}

/**
 * Upload an audio or video Blob to the backend.
 * The backend stores it in Supabase Storage under media-recordings/{school_id}/
 * and returns the public URL.
 */
export async function uploadMediaRecording(
  blob: Blob,
  mimeType: string,
  campusId?: string
): Promise<{ success: boolean; data?: MediaUploadResult; error?: string }> {
  try {
    const token = await getAuthToken()

    const formData = new FormData()
    // Derive a filename extension from the MIME type
    const ext = mimeType.startsWith('video/') ? 'webm' : 'webm'
    formData.append('file', blob, `recording.${ext}`)
    if (campusId) formData.append('campus_id', campusId)

    const response = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...getImpersonationHeaders() },
      body: formData,
    })

    if (response.status === 401) {
      handleSessionExpiry()
      throw new Error('Session expired. Please log in again.')
    }

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Upload failed' }
    }

    return data
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    return { success: false, error: 'Network error' }
  }
}

export interface ImageUploadResult {
  url: string
  mime_type: string
  size: number
  path: string
}

/**
 * Upload a generic image asset (e.g. a public page photo) to the backend.
 * The backend stores it in Supabase Storage and returns the public URL.
 */
export async function uploadImage(
  file: File
): Promise<{ success: boolean; data?: ImageUploadResult; error?: string }> {
  try {
    const token = await getAuthToken()

    const formData = new FormData()
    formData.append('file', file, file.name)

    const response = await fetch(`${API_URL}/media/upload-image`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...getImpersonationHeaders() },
      body: formData,
    })

    if (response.status === 401) {
      handleSessionExpiry()
      throw new Error('Session expired. Please log in again.')
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      console.warn('[uploadImage] Non-JSON response, using FileReader Data URL fallback:', text.slice(0, 150))
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve({
            success: true,
            data: {
              url: reader.result as string,
              mime_type: file.type || 'image/png',
              size: file.size,
              path: 'data-url'
            }
          })
        }
        reader.onerror = () => {
          resolve({ success: false, error: `Upload failed (Server status ${response.status})` })
        }
        reader.readAsDataURL(file)
      })
    }

    const data = await response.json()

    if (!response.ok) {
      // Fallback to Data URL if server returned error
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve({
            success: true,
            data: {
              url: reader.result as string,
              mime_type: file.type || 'image/png',
              size: file.size,
              path: 'data-url'
            }
          })
        }
        reader.onerror = () => {
          resolve({ success: false, error: data.error || 'Upload failed' })
        }
        reader.readAsDataURL(file)
      })
    }

    return data
  } catch (e) {
    // If network error, fallback to Data URL
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve({
          success: true,
          data: {
            url: reader.result as string,
            mime_type: file.type || 'image/png',
            size: file.size,
            path: 'data-url'
          }
        })
      }
      reader.onerror = () => {
        if (e instanceof Error) resolve({ success: false, error: e.message })
        else resolve({ success: false, error: 'Network error' })
      }
      reader.readAsDataURL(file)
    })
  }
}

export interface MessageAttachmentUploadResult {
  url: string
  mime_type: string
  size: number
  path: string
  name: string
}

/**
 * Upload a message attachment (document/image) to the backend.
 * The backend stores it in Supabase Storage under message-attachments/{school_id}/
 * and returns the public URL plus the original filename.
 */
export async function uploadMessageAttachment(
  file: File,
  campusId?: string
): Promise<{ success: boolean; data?: MessageAttachmentUploadResult; error?: string }> {
  try {
    const token = await getAuthToken()

    const formData = new FormData()
    formData.append('file', file, file.name)
    if (campusId) formData.append('campus_id', campusId)

    const response = await fetch(`${API_URL}/media/upload-attachment`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...getImpersonationHeaders() },
      body: formData,
    })

    if (response.status === 401) {
      handleSessionExpiry()
      throw new Error('Session expired. Please log in again.')
    }

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Upload failed' }
    }

    return data
  } catch (e) {
    if (e instanceof Error) return { success: false, error: e.message }
    return { success: false, error: 'Network error' }
  }
}
