import { Request, Response } from 'express'
import { validateSignupToken } from '../services/signup-links.service'
import {
  createPendingSignup,
  isEmailAlreadyUsed,
} from '../services/pending-signups.service'
import { encryptPassword } from '../services/public-signup.service'
import { supabase } from '../config/supabase'
import type { ApiResponse } from '../types'

// GET /public-signup/info/:token — public, no auth
export const getSignupLinkInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params
    if (!token) { res.status(400).json({ success: false, error: 'Token is required' }); return }

    const result = await validateSignupToken(token)

    if (!result.valid || !result.link) {
      res.status(404).json({
        success: false,
        error: result.error ?? 'invalid_link',
      })
      return
    }

    // Fetch school info
    const { data: school } = await supabase
      .from('schools')
      .select('name, logo_url')
      .eq('id', result.link.school_id)
      .single()

    // Fetch campus name if campus-specific
    let campusName: string | null = null
    if (result.link.campus_id) {
      const { data: campus } = await supabase
        .from('schools')
        .select('name')
        .eq('id', result.link.campus_id)
        .single()
      campusName = campus?.name ?? null
    }

    // Compute available seats
    const availableSeats = result.link.max_uses != null
      ? Math.max(0, result.link.max_uses - result.link.use_count)
      : null

    res.json({
      success: true,
      data: {
        role: result.link.role,
        label: result.link.label,
        school_name: school?.name ?? 'School',
        school_logo_url: school?.logo_url ?? null,
        campus_name: campusName,
        expires_at: result.link.expires_at,
        max_uses: result.link.max_uses,
        use_count: result.link.use_count,
        available_seats: availableSeats,
        meta: result.link.meta ?? {},
      },
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

// POST /public-signup/submit — public, no auth
export const submitSignup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, first_name, last_name, email, phone, password, confirm_password, extra_fields } = req.body

    // Validate the fields that are never optional, regardless of link config
    const errors: string[] = []
    if (!token) errors.push('token is required')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('valid email is required')
    if (!password || String(password).length < 8) errors.push('password must be at least 8 characters')
    if (password !== confirm_password) errors.push('passwords do not match')

    if (errors.length > 0) {
      res.status(400).json({ success: false, error: errors.join('; ') } as ApiResponse)
      return
    }

    // Validate token
    const validation = await validateSignupToken(token)
    if (!validation.valid || !validation.link) {
      res.status(400).json({
        success: false,
        error: validation.error ?? 'invalid_link',
      } as ApiResponse)
      return
    }

    const link = validation.link

    // Standard fields (first/last name, phone) can be made optional or hidden per link —
    // defaults below reproduce the previously-hardcoded behavior for links with no config.
    const standardFields = link.meta?.standard_fields ?? {}
    const firstNameRequired = standardFields.first_name?.required ?? true
    const lastNameRequired = standardFields.last_name?.required ?? true
    const phoneEnabled = standardFields.phone?.enabled ?? true
    const phoneRequired = phoneEnabled && (standardFields.phone?.required ?? false)

    const standardFieldErrors: string[] = []
    if (firstNameRequired && (!first_name || String(first_name).trim().length < 2)) {
      standardFieldErrors.push('first_name must be at least 2 characters')
    }
    if (lastNameRequired && (!last_name || String(last_name).trim().length < 2)) {
      standardFieldErrors.push('last_name must be at least 2 characters')
    }
    if (phoneRequired && (!phone || !String(phone).trim())) {
      standardFieldErrors.push('phone is required')
    }
    if (standardFieldErrors.length > 0) {
      res.status(400).json({ success: false, error: standardFieldErrors.join('; ') } as ApiResponse)
      return
    }

    // Validate required custom fields defined in meta
    const customFields = link.meta?.custom_fields ?? []
    const extraFieldErrors: string[] = []
    for (const field of customFields) {
      if (field.required && (!extra_fields || !extra_fields[field.id] || String(extra_fields[field.id]).trim() === '')) {
        extraFieldErrors.push(`${field.label} is required`)
      }
    }
    if (extraFieldErrors.length > 0) {
      res.status(400).json({ success: false, error: extraFieldErrors.join('; ') } as ApiResponse)
      return
    }

    // Check email uniqueness for this school
    const emailUsed = await isEmailAlreadyUsed(email.toLowerCase().trim(), link.school_id)
    if (emailUsed) {
      res.status(409).json({
        success: false,
        error: 'email_already_registered',
      } as ApiResponse)
      return
    }

    // Encrypt password (AES-256 — reversible, so we can create the auth account on approval)
    const encryptedPassword = encryptPassword(password)

    // Create pending signup
    const pendingSignup = await createPendingSignup({
      schoolId: link.school_id,
      campusId: link.campus_id,
      signupLinkId: link.id,
      role: link.role,
      firstName: first_name ? String(first_name).trim() : '',
      lastName: last_name ? String(last_name).trim() : '',
      email: email.toLowerCase().trim(),
      phone: phoneEnabled ? (phone?.trim() || null) : null,
      encryptedPassword,
      extraData: extra_fields ?? {},
    })

    res.status(201).json({
      success: true,
      data: { id: pendingSignup.id },
      message: 'Account created. Awaiting admin approval.',
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
