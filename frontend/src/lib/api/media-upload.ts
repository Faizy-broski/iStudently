import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'

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
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
