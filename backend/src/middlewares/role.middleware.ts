import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { UserRole } from '../types'

/**
 * Middleware factory to check if user has required role
 * @param allowedRoles - Array of roles that can access the route
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: No profile found'
      })
    }

    const userRole = req.profile.role as UserRole

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient permissions',
        details: {
          required: allowedRoles,
          current: userRole
        }
      })
    }

    return next()
  }
}

// Predefined role middlewares
export const requireSuperAdmin = requireRole('super_admin')
export const requireAdmin = requireRole('super_admin', 'admin')
export const requireTeacher = requireRole('super_admin', 'admin', 'teacher')
export const requireStudent = requireRole('super_admin', 'admin', 'teacher', 'student')
// For routes that staff/librarians can also read (like academic years)
export const requireStaff = requireRole('super_admin', 'admin', 'teacher', 'librarian', 'staff')

/**
 * Check if user belongs to specific school (for school-level admins)
 */
export const requireSchoolAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  const schoolId = req.params.schoolId || req.body.school_id
  const userSchoolId = req.profile?.school_id
  const userRole = req.profile?.role

  // Super admin can access all schools
  if (userRole === 'super_admin') {
    return next()
  }

  // Check if user belongs to the school
  if (!userSchoolId || userSchoolId !== schoolId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: You do not have access to this school'
    })
  }

  return next()
}
