import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { SchoolService } from '../services/school.service'
import { CreateSchoolDTO, UpdateSchoolDTO } from '../types'

const schoolService = new SchoolService()

export class SchoolController {
  /**
   * Onboard a new school with admin credentials
   * POST /api/schools/onboard
   * Super Admin only
   */
  async onboardSchool(req: AuthRequest, res: Response) {
    try {
      const { school, admin, billing } = req.body

      // Validate required school fields
      if (!school?.name || !school?.slug || !school?.contact_email) {
        return res.status(400).json({
          success: false,
          error: 'Missing required school fields: name, slug, contact_email'
        })
      }

      // Validate required admin fields
      if (!admin?.email || !admin?.password || !admin?.first_name || !admin?.last_name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required admin fields: email, password, first_name, last_name'
        })
      }

      // Validate password strength
      if (admin.password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long'
        })
      }

      const result = await schoolService.onboardSchool(school, admin, billing)

      res.status(201).json({
        success: true,
        data: result,
        message: `School "${school.name}" onboarded successfully with admin account${billing ? ' and billing setup' : ''}`
      })
    } catch (error: any) {
      console.error('Onboard school error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to onboard school'
      })
    }
  }

  /**
   * Create a new school
   * POST /api/schools
   * Super Admin only
   */
  async createSchool(req: AuthRequest, res: Response) {
    try {
      const schoolData: CreateSchoolDTO = req.body

      // Validate required fields
      if (!schoolData.name || !schoolData.slug || !schoolData.contact_email) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, slug, contact_email'
        })
      }


      // Pass the creator's ID to automatically link them as admin
      const creatorId = req.user?.id
      const school = await schoolService.createSchool(schoolData, creatorId)

      res.status(201).json({
        success: true,
        data: school,
        message: 'School created successfully'
      })
    } catch (error: any) {
      console.error('Create school error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create school'
      })
    }
  }

  /**
   * Get all schools
   * GET /api/schools
   * Super Admin only
   */
  async getAllSchools(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query

      const filters = status ? { status: status as string } : undefined
      const schools = await schoolService.getAllSchools(filters)

      res.json({
        success: true,
        data: schools,
        count: schools.length
      })
    } catch (error: any) {
      console.error('Get schools error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch schools'
      })
    }
  }

  /**
   * Get school by ID
   * GET /api/schools/:id
   */
  async getSchoolById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const school = await schoolService.getSchoolById(id)

      res.json({
        success: true,
        data: school
      })
    } catch (error: any) {
      console.error('Get school error:', error)
      res.status(404).json({
        success: false,
        error: error.message || 'School not found'
      })
    }
  }

  /**
   * Get school by slug
   * GET /api/schools/slug/:slug
   */
  async getSchoolBySlug(req: AuthRequest, res: Response) {
    try {
      const { slug } = req.params
      const school = await schoolService.getSchoolBySlug(slug)

      res.json({
        success: true,
        data: school
      })
    } catch (error: any) {
      console.error('Get school by slug error:', error)
      res.status(404).json({
        success: false,
        error: error.message || 'School not found'
      })
    }
  }

  /**
   * Update school
   * PATCH /api/schools/:id
   * Super Admin only
   */
  async updateSchool(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const updates: UpdateSchoolDTO = req.body

      const school = await schoolService.updateSchool(id, updates)

      res.json({
        success: true,
        data: school,
        message: 'School updated successfully'
      })
    } catch (error: any) {
      console.error('Update school error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update school'
      })
    }
  }

  /**
   * Update school status
   * PATCH /api/schools/:id/status
   * Super Admin only
   */
  async updateSchoolStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { status } = req.body

      if (!status || !['active', 'suspended'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be "active" or "suspended"'
        })
      }

      const school = await schoolService.updateSchoolStatus(id, status)

      res.json({
        success: true,
        data: school,
        message: `School ${status === 'active' ? 'activated' : 'suspended'} successfully`
      })
    } catch (error: any) {
      console.error('Update school status error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update school status'
      })
    }
  }

  /**
   * Delete (suspend) school
   * DELETE /api/schools/:id
   * Super Admin only
   */
  async deleteSchool(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      await schoolService.deleteSchool(id)

      res.json({
        success: true,
        message: 'School suspended successfully'
      })
    } catch (error: any) {
      console.error('Delete school error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to delete school'
      })
    }
  }

  /**
   * Get school statistics
   * GET /api/schools/stats
   * Super Admin only
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await schoolService.getSchoolStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error: any) {
      console.error('Get stats error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch statistics'
      })
    }
  }

  /**
   * Get school count by status
   * GET /api/schools/count-by-status
   * Super Admin only
   */
  async getCountByStatus(req: AuthRequest, res: Response) {
    try {
      const counts = await schoolService.getSchoolCountByStatus()

      res.json({
        success: true,
        data: counts
      })
    } catch (error: any) {
      console.error('Get count by status error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch counts'
      })
    }
  }

  /**
   * Get school admin information
   * GET /api/schools/:id/admin
   * Super Admin only
   */
  async getSchoolAdmin(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      const adminInfo = await schoolService.getSchoolAdmin(id)

      if (!adminInfo) {
        return res.status(404).json({
          success: false,
          error: 'Admin information not found for this school'
        })
      }

      res.json({
        success: true,
        data: adminInfo
      })
    } catch (error: any) {
      console.error('Get school admin error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch admin information'
      })
    }
  }

  /**
   * Update school admin information
   * PATCH /api/schools/:id/admin
   * Super Admin only
   */
  async updateSchoolAdmin(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { admin_name, admin_email, password } = req.body

      if (!admin_email && !admin_name && !password) {
        return res.status(400).json({
          success: false,
          error: 'At least one field (admin_name, admin_email, or password) is required'
        })
      }

      if (password && password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long'
        })
      }

      const result = await schoolService.updateSchoolAdmin(id, {
        admin_name,
        admin_email,
        password
      })

      res.json({
        success: true,
        data: result,
        message: 'Admin information updated successfully'
      })
    } catch (error: any) {
      console.error('Update school admin error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update admin information'
      })
    }
  }

  /**
   * Get school settings for the admin's school
   * GET /api/schools/settings
   */
  async getSchoolSettings(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID is required'
        });
      }

      const settings = await schoolService.getSchoolSettings(schoolId);

      res.json({
        success: true,
        data: settings
      });
    } catch (error: any) {
      console.error('Get school settings error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get school settings'
      });
    }
  }

  /**
   * Update school settings for the admin's school
   * PUT /api/schools/settings
   */
  async updateSchoolSettings(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID is required'
        });
      }

      const settings = await schoolService.updateSchoolSettings(schoolId, req.body);

      res.json({
        success: true,
        data: settings,
        message: 'Settings updated successfully'
      });
    } catch (error: any) {
      console.error('Update school settings error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update school settings'
      })
    }
  }

  /**
   * Get schools for the current user
   * GET /api/schools/my-schools
   */
  async getMySchools(req: AuthRequest, res: Response) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
      }

      const schools = await schoolService.getMySchools(req.user.id)

      res.status(200).json({
        success: true,
        data: schools
      })
    } catch (error: any) {
      console.error('Get my schools error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to fetch your schools'
      })
    }
  }

  /**
   * Switch active school context
   * POST /api/schools/switch-context
   */
  async switchSchool(req: AuthRequest, res: Response) {
    try {
      const { schoolId } = req.body

      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
      }

      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'School ID is required' })
      }

      const result = await schoolService.switchSchoolContext(req.user.id, schoolId)

      res.status(200).json({
        success: true,
        data: result.school,
        message: 'School context switched successfully'
      })
    } catch (error: any) {
      console.error('Switch school error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to switch school'
      })
    }
  }

  /**
   * Toggle user active status (deactivate/reactivate)
   * PATCH /api/schools/users/:userId/toggle-status
   */
  async toggleUserStatus(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params
      const { isActive } = req.body

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' })
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, error: 'isActive must be a boolean' })
      }

      const result = await schoolService.toggleUserActiveStatus(userId, isActive)

      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      })
    } catch (error: any) {
      console.error('Toggle user status error:', error)
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to toggle user status'
      })
    }
  }
}
