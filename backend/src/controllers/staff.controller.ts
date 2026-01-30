import { Request, Response } from 'express'

import { createClient } from '@supabase/supabase-js'
import * as StaffService from '../services/staff.service'
import { CreateStaffDTO } from '../types'
import { getEffectiveSchoolId, validateCampusAccess } from '../utils/campus-validation'

// Create a Supabase Admin client for Auth operations
// process.env.SUPABASE_URL and process.env.SUPABASE_SERVICE_ROLE_KEY should be available
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export const getAllStaff = async (req: Request, res: Response) => {
    try {
        const { school_id: adminSchoolId } = (req as any).profile!
        const { page, limit, search, role, campus_id } = req.query

        // Use campus_id if provided (for campus filtering), otherwise use admin's school_id
        const effectiveSchoolId = campus_id ? campus_id as string : adminSchoolId

        console.log('📋 GET ALL STAFF REQUEST:')
        console.log('  - Admin School ID:', adminSchoolId)
        console.log('  - Requested Campus ID:', campus_id)
        console.log('  - Effective School ID (filtering by):', effectiveSchoolId)

        const result = await StaffService.getAllStaff(effectiveSchoolId, {
            page: Number(page),
            limit: Number(limit),
            search: search as string,
            role: role as 'staff' | 'librarian' | 'all'
        })

        if (!result.success) {
            return res.status(400).json(result)
        }
        return res.json(result)
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const getStaffById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params
        const adminSchoolId = (req as any).profile?.school_id
        
        // Get staff without school filter first
        const result = await StaffService.getStaffById(id)
        
        if (!result.success) {
            return res.status(404).json(result)
        }
        
        // SECURITY: Validate admin has access to this staff's campus
        if (adminSchoolId && result.data?.school_id) {
            const hasAccess = await validateCampusAccess(adminSchoolId, result.data.school_id)
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: Staff member belongs to a different school'
                })
            }
        }
        
        return res.json(result)
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const createStaff = async (req: Request, res: Response) => {
    try {
        const adminSchoolId = (req as any).profile!.school_id
        const creatorId = (req as any).profile!.id  // Fixed: use profile.id instead of user.id
        const data: CreateStaffDTO = req.body

        console.log('👤 CREATE STAFF REQUEST:')
        console.log('  - Admin School ID:', adminSchoolId)
        console.log('  - Creator ID:', creatorId)
        console.log('  - Request Body:', JSON.stringify(req.body, null, 2))
        console.log('  - Campus ID from request:', req.body.campus_id)
        console.log('  - School ID from request:', req.body.school_id)

        // Get the effective school ID (campus) to use
        const effectiveSchoolId = await getEffectiveSchoolId(
            adminSchoolId,
            req.body.campus_id || req.body.school_id
        )

        console.log('  - Effective School ID (will be used):', effectiveSchoolId)

        // 1. Determine Role
        // If title is 'Librarian' (case insensitive), role is 'librarian', else 'staff'
        let role = 'staff'
        if (data.title && data.title.toLowerCase().trim() === 'librarian') {
            role = 'librarian'
        }

        // 2. Create Auth User
        console.log('🔐 Creating auth user with email:', data.email)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password || 'TempPass123!', // Should be provided or generated
            email_confirm: true,
            user_metadata: {
                first_name: data.first_name,
                last_name: data.last_name,
                school_id: effectiveSchoolId,
                role: role // 'staff' or 'librarian'
            }
        })

        if (authError) {
            console.error('❌ Auth user creation error:', authError)
            return res.status(400).json({ success: false, error: authError.message })
        }

        if (!authUser.user) {
            console.error('❌ Auth user creation failed - no user returned')
            return res.status(500).json({ success: false, error: 'Failed to create auth user' })
        }

        console.log('✅ Auth user created:', authUser.user.id)

        // 3. Create Staff Record via Service
        console.log('📝 Creating staff record...')
        const newStaff = await StaffService.createStaffRecord(
            effectiveSchoolId,
            authUser.user.id,
            data,
            creatorId
        )

        console.log('✅ Staff created successfully:', newStaff.id)
        return res.status(201).json({ success: true, data: newStaff })

    } catch (error: any) {
        console.error('❌ Error creating staff:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}

export const updateStaff = async (req: Request, res: Response) => {
    try {
        const adminSchoolId = (req as any).profile?.school_id
        const { id } = req.params
        
        // Get staff first to validate access
        const existing = await StaffService.getStaffById(id)
        if (!existing.success) {
            return res.status(404).json(existing)
        }
        
        // SECURITY: Validate admin has access to this staff's campus
        if (adminSchoolId && existing.data?.school_id) {
            const hasAccess = await validateCampusAccess(adminSchoolId, existing.data.school_id)
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: Staff member belongs to a different school'
                })
            }
        }
        
        const result = await StaffService.updateStaff(id, existing.data!.school_id, req.body)
        if (!result.success) return res.status(400).json(result)
        return res.json(result)
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

export const deleteStaff = async (req: Request, res: Response) => {
    try {
        const adminSchoolId = (req as any).profile?.school_id
        const { id } = req.params
        
        // Fetch staff to validate access and get profile ID
        const staff = await StaffService.getStaffById(id)
        
        if (!staff.success || !staff.data) {
            return res.status(404).json({ success: false, message: 'Staff not found' })
        }
        
        // SECURITY: Validate admin has access to this staff's campus
        if (adminSchoolId && staff.data.school_id) {
            const hasAccess = await validateCampusAccess(adminSchoolId, staff.data.school_id)
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: Staff member belongs to a different school'
                })
            }
        }
        
        if (staff.data.profile_id) {
            const { error } = await supabaseAdmin.auth.admin.deleteUser(staff.data.profile_id)
            if (error) throw error
            return res.json({ success: true, message: 'Staff deleted successfully' })
        }

        return res.status(404).json({ success: false, message: 'Staff not found' })
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message })
    }
}

// Get current staff/librarian's own profile
export const getMyProfile = async (req: Request, res: Response) => {
    try {
        const { id: profileId, school_id: schoolId } = (req as any).profile!

        // Get staff record by profile_id
        const result = await StaffService.getStaffByProfileId(profileId, schoolId)

        if (!result.success) {
            return res.status(404).json(result)
        }

        return res.json(result)
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message })
    }
}
