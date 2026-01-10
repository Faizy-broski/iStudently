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

    const token = authHeader.replace('Bearer ', '')

    // Verify JWT token with Supabase
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token)
    
    if (userError || !user) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid or expired token' 
      })
    }

    // Fetch user profile from database using service role (bypasses RLS)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('🔍 Auth Debug:', {
      userId: user.id,
      userEmail: user.email,
      profileFound: !!profile,
      profileError: profileError?.message,
      profile: profile
    })

    if (profileError || !profile) {
      console.error('❌ Profile lookup failed:', {
        error: profileError,
        userId: user.id
      })
      return res.status(404).json({ 
        success: false,
        error: 'User profile not found' 
      })
    }

    // Check if user is active
    if (!profile.is_active) {
      return res.status(403).json({ 
        success: false,
        error: 'Account is inactive. Please contact administrator.' 
      })
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
