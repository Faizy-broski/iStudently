'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const COOKIE_NAME = 'studently_language'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export async function setUserLocale(locale: 'en' | 'ar'): Promise<void> {
  const cookieStore = await cookies()

  // Set the cookie that next-intl reads on every server render
  cookieStore.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
  })

  // Persist to DB asynchronously — non-blocking, failure is acceptable
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/language`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ language: locale }),
    })
  } catch {
    // DB persistence failure doesn't break the locale switch
  }
}
