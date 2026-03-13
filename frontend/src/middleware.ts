import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Lean middleware: checks session existence only (no DB query).
 * Role enforcement is handled client-side by RoleGuard.
 * Full token validation happens at the backend API level.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Read session from cookies — no network call, no DB query
  const { data: { session } } = await supabase.auth.getSession()

  const isProtectedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/teacher') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/superadmin') ||
    pathname.startsWith('/librarian') ||
    pathname.startsWith('/profile')

  const isAuthRoute = pathname.startsWith('/auth/login')

  // No session → redirect to login
  if (!session && isProtectedRoute) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Has session → don't show login page again, send to root (client handles role redirect)
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
