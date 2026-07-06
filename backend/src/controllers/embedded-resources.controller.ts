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
    staff_id?: string
    student_id?: string
  }
}

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
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch embedded resources' } as ApiResponse)
  }
}

export const getForUser = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'Profile required' } as ApiResponse)

    const schoolId = profile.campus_id || profile.school_id

    const resources = await service.getEmbeddedResourcesForUser(schoolId, {
      role:      profile.role,
      gradeId:   (req.query.grade_id as string | undefined) || profile.grade_id || null,
      sectionId: profile.section_id  || null,
      staffId:   profile.staff_id    || null,
      studentId: profile.student_id  || null,
      profileId: profile.id          || null,
    })
    res.json({ success: true, data: resources } as ApiResponse)
  } catch (error: any) {
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
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch embedded resource' } as ApiResponse)
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'Profile required' } as ApiResponse)

    const {
      title, url,
      published_grade_ids, published_section_ids,
      visible_to_roles, visible_to_teacher_ids, visible_to_student_ids,
      sort_order, category_id,
    } = req.body
    if (!title || !url) return res.status(400).json({ success: false, error: 'Title and URL are required' } as ApiResponse)

    const schoolId = resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const resource = await service.createEmbeddedResource({
      school_id:               schoolId,
      title,
      url,
      published_grade_ids:     published_grade_ids     || [],
      published_section_ids:   published_section_ids   || [],
      visible_to_roles:        visible_to_roles        || [],
      visible_to_teacher_ids:  visible_to_teacher_ids  || [],
      visible_to_student_ids:  visible_to_student_ids  || [],
      sort_order,
      category_id: category_id ?? null,
      created_by: profile.id,
    })

    res.status(201).json({ success: true, data: resource, message: 'Embedded resource created' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create embedded resource' } as ApiResponse)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query') || resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const resource = await service.updateEmbeddedResource(req.params.id, schoolId, req.body)
    res.json({ success: true, data: resource, message: 'Embedded resource updated' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update embedded resource' } as ApiResponse)
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    await service.deleteEmbeddedResource(req.params.id, schoolId)
    res.json({ success: true, message: 'Embedded resource deleted' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to delete embedded resource' } as ApiResponse)
  }
}
