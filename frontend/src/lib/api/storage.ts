import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

/**
 * Upload file to Supabase Storage
 * Production-ready approach for handling file uploads
 * Path structure: {school_id}/{campus_id}/{academic_year}/{assignmentId}/submissions/{userId}/{fileName}
 * Note: userId is profile.id (auth.uid()), not student_id
 */
export async function uploadAssignmentFile(
  file: File,
  userId: string,
  assignmentId: string,
  schoolId: string,
  campusId: string,
  academicYearId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Create unique file path with school/campus/year isolation
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${schoolId}/${campusId}/${academicYearId}/${assignmentId}/submissions/${userId}/${fileName}`

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('Assignments_uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('Assignments_uploads')
      .getPublicUrl(data.path)

    return {
      success: true,
      url: publicUrl
    }
  } catch (error: unknown) {
    console.error('Upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file'
    }
  }
}

/**
 * Upload multiple files concurrently with rate limiting
 * Handles massive submissions efficiently
 */
export async function uploadMultipleFiles(
  files: File[],
  userId: string,
  assignmentId: string,
  schoolId: string,
  campusId: string,
  academicYearId: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; urls?: string[]; error?: string }> {
  try {
    const urls: string[] = []
    let completed = 0

    // Upload files in batches of 3 to avoid overwhelming the server
    const batchSize = 3
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      
      const results = await Promise.all(
        batch.map(file => uploadAssignmentFile(file, userId, assignmentId, schoolId, campusId, academicYearId))
      )

      for (const result of results) {
        if (!result.success || !result.url) {
          return {
            success: false,
            error: result.error || 'Failed to upload file'
          }
        }
        urls.push(result.url)
        completed++
        
        if (onProgress) {
          onProgress((completed / files.length) * 100)
        }
      }
    }

    return {
      success: true,
      urls
    }
  } catch (error: unknown) {
    console.error('Batch upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload files'
    }
  }
}

/**
 * Delete file from storage
 */
export async function deleteAssignmentFile(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from('Assignments_uploads')
      .remove([filePath])

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file'
    }
  }
}
