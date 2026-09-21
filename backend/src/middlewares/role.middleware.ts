import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { UserRole } from '../types'
import { decideStaffModuleAccess, loadProfilePermissions } from '../services/module-access.service'

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

    // Super admin can access any route that requires specific roles
    if (userRole === 'super_admin') {
      return next()
    }

    // Staff accounts run inside the admin app, limited to the modules their User Profile
    // (role) grants. Routes written as "admin only" therefore also admit a staff user whose
    // profile grants the module that owns this API area (reads need "can use", writes need
    // "can edit"); anything not mapped, or not granted, stays forbidden. A staff account with
    // no profile assigned gets nothing.
    if (userRole === 'staff' && allowedRoles.includes('admin')) {
      const profileId = req.profile.user_profile_id
      if (!profileId) return denyForbidden(res, allowedRoles, userRole, 'no access role assigned to this staff account')

      return loadProfilePermissions(profileId)
        .then((perms) => {
          const decision = decideStaffModuleAccess(perms, req.originalUrl, req.method)
          if (decision.allowed) return next()
          return denyForbidden(res, allowedRoles, userRole, decision.reason ?? 'not granted')
        })
        .catch((err) => {
          console.error('Module access check failed:', err)
          return res.status(500).json({ success: false, error: 'Could not verify module access' })
        })
    }

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

function denyForbidden(res: Response, required: UserRole[], current: UserRole, reason: string) {
  return res.status(403).json({
    success: false,
    // The reason is shown to the user (toasts print `error`) so a refused action explains itself
    error: `Forbidden: Insufficient permissions (${reason})`,
    details: { required, current, reason }
  })
}

// Predefined role middlewares
export const requireSuperAdmin = requireRole('super_admin')
export const requireAdmin = requireRole('super_admin', 'admin')
export const requireTeacher = requireRole('super_admin', 'admin', 'teacher')
export const requireStudent = requireRole('super_admin', 'admin', 'teacher', 'student')
// For routes that staff/librarians can also read (like academic years)
export const requireStaff = requireRole('super_admin', 'admin', 'teacher', 'librarian', 'staff')
// Inspectors are a standalone role, not part of the admin hierarchy — their
// actual campus access is further scoped per-request by inspector-access.ts,
// not by this role check alone (super_admin still bypasses via requireRole's
// built-in super_admin shortcut above, for support/troubleshooting access).
export const requireInspector = requireRole('inspector')

// Al-Fina' module roles — standalone, not part of the admin hierarchy.
// MEDIA_OFFICER performs first-review moderation before a post reaches the
// principal's (admin's) approval queue. FINA_SUPERVISOR is municipal-level
// and cross-school by design; its actual school scope is further resolved
// per-request by fina/supervisor-access.service.ts, not by this role check
// alone (super_admin still bypasses via requireRole's built-in shortcut).
export const requireMediaOfficer = requireRole('media_officer')
export const requireFinaSupervisor = requireRole('fina_supervisor')

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
