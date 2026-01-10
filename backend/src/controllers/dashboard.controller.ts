import { Response } from 'express'
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
}
