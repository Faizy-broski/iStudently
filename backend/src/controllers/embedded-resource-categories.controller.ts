import { Request, Response } from 'express'
import * as service from '../services/embedded-resource-categories.service'
import { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
    campus_id?: string
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

export const list = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const categories = await service.getCategories(schoolId)
    res.json({ success: true, data: categories } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch categories' } as ApiResponse)
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'Profile required' } as ApiResponse)

    const { name, sort_order } = req.body
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'Name is required' } as ApiResponse)

    const schoolId = resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const category = await service.createCategory({
      school_id:  schoolId,
      name:       name.trim(),
      sort_order,
      created_by: profile.id,
    })

    res.status(201).json({ success: true, data: category, message: 'Category created' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create category' } as ApiResponse)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query') || resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const category = await service.updateCategory(req.params.id, schoolId, req.body)
    res.json({ success: true, data: category, message: 'Category updated' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update category' } as ApiResponse)
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    await service.deleteCategory(req.params.id, schoolId)
    res.json({ success: true, message: 'Category deleted' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to delete category' } as ApiResponse)
  }
}
