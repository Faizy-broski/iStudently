import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

import { env } from './env'
import { chunkedSecureStorage } from './secure-storage'

// Auth only. Data goes through the Express API (see CLAUDE.md "Do not").
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: chunkedSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Password-reset links come back as studently://reset-password?code=... (exchanged on this device).
    flowType: 'pkce',
  },
})

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
