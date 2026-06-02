import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Automatically refresh the session before it expires
        autoRefreshToken: true,
        // Persist the session to localStorage
        persistSession: true,
        // Detect when the session is about to expire and refresh it
        detectSessionInUrl: true,
        // Refresh the session 60 seconds before it expires
        flowType: 'pkce',
      },
    }
  )
}
