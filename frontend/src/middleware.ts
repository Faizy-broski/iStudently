import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Middleware to protect routes and handle role-based redirects
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Create response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Get user session with error handling
  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    
    if (error) {
      // If refresh token is invalid, clear cookies and redirect to login
      if (error.message.includes('refresh_token_not_found') || 
          error.message.includes('Invalid Refresh Token')) {
        console.log('🔄 Refresh token expired, clearing session')
        // Clear all auth cookies
        const cookiesToClear = [
          'sb-access-token',
          'sb-refresh-token',
          `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`
        ]
        cookiesToClear.forEach(cookie => {
          response.cookies.delete(cookie)
        })
        
        // Redirect to login if not already there
        if (!pathname.startsWith('/auth/login')) {
          return NextResponse.redirect(new URL('/auth/login?error=session_expired', request.url))
        }
      }
    } else {
      user = data.user
    }
  } catch (error) {
    console.error('❌ Auth error in middleware:', error)
    user = null
  }

  // Get user profile if user exists
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/login']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If user is logged in and trying to access login/register, redirect to their dashboard
  if (user && profile && isPublicRoute) {
    return NextResponse.redirect(new URL(getDashboardPath(profile.role), request.url))
  }

  // If user is not logged in and trying to access protected routes
  if (!user && !isPublicRoute && pathname !== '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Role-based route protection
  if (user && profile) {
    // Check if user is inactive first
    if (!profile.is_active) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/auth/login?error=account_inactive', request.url))
    }

    // Define role-based route mappings
    const roleRoutes: Record<string, string> = {
      '/superadmin': 'super_admin',
      '/admin': 'admin',
      '/teacher': 'teacher',
      '/student': 'student',
      '/parent': 'parent',
    }

    // Check if accessing a role-specific route
    for (const [route, requiredRole] of Object.entries(roleRoutes)) {
      if (pathname.startsWith(route) && profile.role !== requiredRole) {
        return NextResponse.redirect(new URL('/auth/login?error=unauthorized', request.url))
      }
    }
  }

  // Redirect root to appropriate dashboard or login
  if (pathname === '/') {
    if (user && profile) {
      return NextResponse.redirect(new URL(getDashboardPath(profile.role), request.url))
    }
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return response
}

/**
 * Get dashboard path based on user role
 */
function getDashboardPath(role: string): string {
  switch (role) {
    case 'super_admin':
      return '/superadmin/dashboard'
    case 'admin':
      return '/admin/dashboard'
    case 'teacher':
      return '/teacher/dashboard'
    case 'student':
      return '/student/dashboard'
    case 'parent':
      return '/parent/dashboard'
    default:
      return '/auth/login?error=role_not_supported'
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
