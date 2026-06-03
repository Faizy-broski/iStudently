import { Request, Response } from 'express'
import * as service from '../services/embedded-resources.service'
import { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
    grade_id?: string
    campus_id?: string
    section_id?: string
  }
}

// Resolve the effective campus/school id for a request.
// Prefers explicit query/body value (sent by admin with selectedCampus),
// then profile.campus_id (students/teachers enriched from their section/staff row),
// then profile.school_id as last resort.
function resolveSchoolId(req: Request, source: 'query' | 'body' = 'query'): string | null {
  const profile = (req as AuthRequest).profile
  const explicit =
    source === 'query'
      ? (req.query.school_id as string | undefined)
      : (req.body.campus_id as string | undefined) || (req.body.school_id as string | undefined)

  return explicit || profile?.campus_id || profile?.school_id || null
}

export const getAll = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const resources = await service.getEmbeddedResources(schoolId)
    res.json({ success: true, data: resources } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching embedded resources:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch embedded resources' } as ApiResponse)
  }
}

// For non-admin users — grade-filtered for students, unfiltered for teachers/parents
export const getForUser = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const schoolId = profile.campus_id || profile.school_id
    // grade_id from query overrides profile; section_id used to resolve grade when grade_id missing
    const explicitGradeId = req.query.grade_id as string | undefined

    const resources = await service.getEmbeddedResourcesForUser(
      schoolId,
      profile.role,
      explicitGradeId,
      profile.section_id
    )
    res.json({ success: true, data: resources } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching embedded resources for user:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch embedded resources' } as ApiResponse)
  }
}

export const getById = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const resource = await service.getEmbeddedResourceById(req.params.id, schoolId)
    if (!resource) return res.status(404).json({ success: false, error: 'Embedded resource not found' } as ApiResponse)

    res.json({ success: true, data: resource } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching embedded resource:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch embedded resource' } as ApiResponse)
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const { title, url, published_grade_ids } = req.body
    if (!title || !url) return res.status(400).json({ success: false, error: 'Title and URL are required' } as ApiResponse)

    // campus_id from body (sent by admin frontend) takes priority
    const schoolId = resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const resource = await service.createEmbeddedResource({
      school_id: schoolId,
      title,
      url,
      published_grade_ids: published_grade_ids || [],
      created_by: profile.id,
    })

    res.status(201).json({ success: true, data: resource, message: 'Embedded resource created successfully' } as ApiResponse)
  } catch (error: any) {
    console.error('Error creating embedded resource:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to create embedded resource' } as ApiResponse)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query') || resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const resource = await service.updateEmbeddedResource(req.params.id, schoolId, req.body)
    res.json({ success: true, data: resource, message: 'Embedded resource updated successfully' } as ApiResponse)
  } catch (error: any) {
    console.error('Error updating embedded resource:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to update embedded resource' } as ApiResponse)
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    await service.deleteEmbeddedResource(req.params.id, schoolId)
    res.json({ success: true, message: 'Embedded resource deleted successfully' } as ApiResponse)
  } catch (error: any) {
    console.error('Error deleting embedded resource:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to delete embedded resource' } as ApiResponse)
  }
}
