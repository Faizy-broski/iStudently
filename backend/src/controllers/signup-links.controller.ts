import { Request, Response } from 'express'
import * as signupLinksService from '../services/signup-links.service'
import { getProfileFieldsForRole, type ProfileFieldDef } from '../services/profile-field-registry'
import { customFieldsService, type EntityType } from '../services/custom-fields.service'
import type { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: { id: string; school_id: string | null; role: string }
}

const VALID_ROLES = ['teacher', 'student', 'parent', 'staff', 'librarian', 'counselor']

export const generateLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const { role, label, max_uses, expires_at, campus_id, meta } = req.body

    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ success: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` } as ApiResponse)
      return
    }

    const link = await signupLinksService.generateSignupLink({
      schoolId,
      campusId: campus_id ?? null,
      role,
      label: label ?? null,
      maxUses: max_uses != null ? Number(max_uses) : null,
      expiresAt: expires_at ? new Date(expires_at) : null,
      createdBy: req.profile!.id,
      meta: meta ?? {},
    })

    res.status(201).json({ success: true, data: link } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}


export const getLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const campusId = req.query.campus_id as string | undefined
    const links = await signupLinksService.getSignupLinks(schoolId, campusId)

    res.json({ success: true, data: links } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const deactivateLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    await signupLinksService.deactivateSignupLink(req.params.id, schoolId)
    res.json({ success: true, message: 'Link deactivated' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const activateLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    await signupLinksService.activateSignupLink(req.params.id, schoolId)
    res.json({ success: true, message: 'Link activated' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

// Maps a signup-link `role` onto the custom-fields entity type whose
// definitions should be offered when building a link for that role.
function roleToCustomFieldEntityType(role: string): EntityType | null {
  if (role === 'student') return 'student'
  if (role === 'teacher') return 'teacher'
  if (role === 'parent') return 'parent'
  if (role === 'staff' || role === 'librarian' || role === 'counselor') return 'staff'
  return null
}

// Custom field types that the public signup form can actually render today
// (see frontend/src/app/signup/[token]/page.tsx for the matching input per type).
// 'file' is intentionally excluded — the public signup form has no upload storage flow.
const SUPPORTED_CUSTOM_FIELD_TYPES: Record<string, ProfileFieldDef['type']> = {
  text: 'text',
  'long-text': 'textarea',
  number: 'text',
  date: 'date',
  select: 'select',
  checkbox: 'checkbox',
  'multi-select': 'multi-select',
}

export const getProfileFields = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.query.role as string | undefined
    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ success: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` } as ApiResponse)
      return
    }

    const fields: ProfileFieldDef[] = [...getProfileFieldsForRole(role)]

    const schoolId = req.profile?.school_id
    const entityType = roleToCustomFieldEntityType(role)
    if (schoolId && entityType) {
      const definitions = await customFieldsService.getFieldDefinitions(schoolId, entityType)
      for (const def of definitions) {
        if (!def.is_active) continue
        const mappedType = SUPPORTED_CUSTOM_FIELD_TYPES[def.type]
        if (!mappedType) continue // skip types the public signup form can't render (checkbox, multi-select, file)

        fields.push({
          source: 'custom_field',
          field_key: def.field_key,
          label_en: def.label,
          label_ar: def.label,
          type: mappedType,
          options: (mappedType === 'select' || mappedType === 'multi-select') ? def.options.map(o => ({ id: o, label_en: o, label_ar: o })) : undefined,
          appliesToRoles: [role],
        })
      }
    }

    res.json({ success: true, data: fields } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const deleteLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    await signupLinksService.deleteSignupLink(req.params.id, schoolId)
    res.json({ success: true, message: 'Link deleted' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
