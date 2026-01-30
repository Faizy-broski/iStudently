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
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token)
    
    if (userError || !user) {
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

    // If user is a student, fetch their student record
    if (profile.role === 'student') {
      const { data: studentRecord, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .single()

      if (!studentError && studentRecord) {
        profile.student_id = studentRecord.id
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
