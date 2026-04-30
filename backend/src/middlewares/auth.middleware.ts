import { Request, Response, NextFunction } from 'express'
import { supabaseAuth, supabase } from '../config/supabase'

export interface AuthRequest extends Request {
  user?: any
  profile?: any
}

/**
 * Middleware to authenticate requests using JWT token
 * Verifies the token and attaches user and profile to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Please include Authorization header.'
      })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    // Validate token format (JWT should have 3 parts separated by dots)
    if (!token || token.split('.').length !== 3) {
      console.error('❌ Malformed JWT token:', {
        hasToken: !!token,
        tokenLength: token?.length,
        segments: token?.split('.').length,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'empty'
      })
      return res.status(401).json({
        success: false,
        error: 'Malformed authentication token. Please sign in again.'
      })
    }

    // Verify JWT token with Supabase
    let user: any = null
    let userError: any = null
    try {
      const result = await supabaseAuth.auth.getUser(token)
      user = result.data?.user
      userError = result.error
    } catch (fetchErr: any) {
      // Network-level failure (ECONNRESET, ETIMEDOUT, fetch failed, etc.)
      // This is NOT an auth failure — the token may be perfectly valid.
      const msg = fetchErr?.message || String(fetchErr)
      const isNetworkError =
        msg.includes('fetch failed') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('network') ||
        msg.includes('socket')
      console.error('❌ Auth service unreachable (network error):', msg)
      if (isNetworkError) {
        return res.status(503).json({
          success: false,
          error: 'Auth service temporarily unreachable. Please retry.',
          retryable: true
        })
      }
      throw fetchErr
    }

    if (userError || !user) {
      // Distinguish transient Supabase network errors from real auth errors
      const errMsg = userError?.message || ''
      const isNetworkError =
        errMsg.includes('fetch failed') ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('network') ||
        errMsg.includes('socket') ||
        userError?.status === 0
      if (isNetworkError) {
        console.error('❌ Auth service network error (not a bad token):', errMsg)
        return res.status(503).json({
          success: false,
          error: 'Auth service temporarily unreachable. Please retry.',
          retryable: true
        })
      }
      console.error('❌ Token verification failed:', {
        error: userError?.message,
        errorCode: userError?.code,
        hasUser: !!user
      })
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        details: process.env.NODE_ENV === 'development' ? userError?.message : undefined
      })
    }

    // Fetch user profile from database using service role (bypasses RLS)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profile lookup failed:', {
        error: profileError,
        userId: user.id
      })
      return res.status(401).json({
        success: false,
        error: 'User profile not found. Please contact administrator to set up your account.'
      })
    }

    // Check if user is active
    if (!profile.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Account is inactive. Please contact administrator.'
      })
    }

    // If user is a student, fetch their student record.
    if (typeof profile.role === 'string' && profile.role.toLowerCase() === 'student') {
      const { data: studentRecord, error: studentError } = await supabase
        .from('students')
        .select('id, school_id, section_id')
        .or(`profile_id.eq.${profile.id},id.eq.${profile.id}`)
        .single()

      if (!studentError && studentRecord) {
        profile.student_id = studentRecord.id
        if (studentRecord.section_id) profile.section_id = studentRecord.section_id

        if (studentRecord.school_id) {
          profile.campus_id = studentRecord.school_id
          
          // Resolve parent school so that getMarkingPeriods/getAcademicYears work.
          // In this system, marking periods are linked to the main school.
          const { data: campusRecord } = await supabase
            .from('schools')
            .select('id, parent_school_id')
            .eq('id', studentRecord.school_id)
            .single()

          if (campusRecord?.parent_school_id) {
            // The campus is a child school — set school_id to the parent
            profile.school_id = campusRecord.parent_school_id
          } else if (campusRecord) {
            // If parent_school_id is null, the school_id is already the parent
            profile.school_id = campusRecord.id
          }
        }
      } else if (studentError && studentError.code !== 'PGRST116') {
        console.warn('⚠️ Student record lookup failed for profile:', profile.id, studentError)
      }
    }

    // For librarians, teachers and staff: fetch their campus assignment from the staff table.
    // The staff.school_id column stores the CAMPUS id (child school).
    // We also need to resolve the parent school so that getCampuses() works correctly.
    if (profile.role === 'librarian' || profile.role === 'teacher' || profile.role === 'staff') {
      const { data: staffRecord } = await supabase
        .from('staff')
        .select('id, school_id')
        .eq('profile_id', profile.id)
        .single()

      if (staffRecord?.school_id) {
        profile.campus_id = staffRecord.school_id
        profile.staff_id = staffRecord.id

        // Resolve parent school so that getCampuses(profile.school_id) works.
        // If the profile already has the parent school_id, skip this lookup.
        const { data: campusRecord } = await supabase
          .from('schools')
          .select('id, parent_school_id')
          .eq('id', staffRecord.school_id)
          .single()

        if (campusRecord?.parent_school_id) {
          // The campus is a child school — set school_id to the parent
          profile.school_id = campusRecord.parent_school_id
        }
        // If parent_school_id is null, school_id is already the parent school — keep it.
      }
    }

    // Attach user and profile to request
    req.user = user
    req.profile = profile

    return next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    })
  }
}
