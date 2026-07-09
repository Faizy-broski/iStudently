import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { DashboardService } from '../services/dashboard.service'

const dashboardService = new DashboardService()

export class DashboardController {
  /**
   * Get dashboard statistics
   * GET /api/dashboard/stats
   * Super Admin only
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const stats = await dashboardService.getDashboardStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error: any) {
      console.error('Get dashboard stats error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch dashboard statistics'
      })
    }
  }

  /**
   * Get school growth data (monthly)
   * GET /api/dashboard/school-growth
   * Super Admin only
   */
  async getSchoolGrowth(req: AuthRequest, res: Response) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
      const data = await dashboardService.getSchoolGrowth(year)

      res.json({
        success: true,
        data
      })
    } catch (error: any) {
      console.error('Get school growth error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch school growth data'
      })
    }
  }

  /**
   * Get revenue data (monthly)
   * GET /api/dashboard/revenue
   * Super Admin only
   */
  async getRevenue(req: AuthRequest, res: Response) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
      const data = await dashboardService.getRevenueData(year)

      res.json({
        success: true,
        data
      })
    } catch (error: any) {
      console.error('Get revenue data error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch revenue data'
      })
    }
  }

  /**
   * Get recent schools
   * GET /api/dashboard/recent-schools
   * Super Admin only
   */
  async getRecentSchools(req: AuthRequest, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 4
      const schools = await dashboardService.getRecentSchools(limit)

      res.json({
        success: true,
        data: schools
      })
    } catch (error: any) {
      console.error('Get recent schools error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch recent schools'
      })
    }
  }

  async getPlatformSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await dashboardService.getPlatformSettings()
      res.json({ success: true, data: settings })
    } catch (error: any) {
      console.error('Get platform settings error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch platform settings' })
    }
  }

  async updatePlatformSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await dashboardService.updatePlatformSettings(req.body)
      res.json({ success: true, data: settings, message: 'Platform settings updated' })
    } catch (error: any) {
      console.error('Update platform settings error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update platform settings' })
    }
  }

  // Public — read by the unauthenticated /auth/login page
  async getLoginPageConfig(req: Request, res: Response) {
    try {
      const config = await dashboardService.getLoginPageConfig()
      res.json({ success: true, data: config })
    } catch (error: any) {
      console.error('Get login page config error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch login page config' })
    }
  }

  async updateLoginPageConfig(req: AuthRequest, res: Response) {
    try {
      const config = await dashboardService.updateLoginPageConfig(req.body)
      res.json({ success: true, data: config, message: 'Login page config updated' })
    } catch (error: any) {
      console.error('Update login page config error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update login page config' })
    }
  }

  async resetLoginPageConfig(req: AuthRequest, res: Response) {
    try {
      const config = await dashboardService.resetLoginPageConfig()
      res.json({ success: true, data: config, message: 'Login page config reset to defaults' })
    } catch (error: any) {
      console.error('Reset login page config error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to reset login page config' })
    }
  }
}
