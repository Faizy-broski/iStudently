import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const COOKIE_NAME = 'studently_language'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export async function POST(request: NextRequest) {
  const { locale } = await request.json()

  if (locale !== 'en' && locale !== 'ar') {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
  })

  // Persist to DB non-blocking
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/language`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ language: locale }),
      }).catch(() => {})
    }
  } catch {}

  return response
}
