import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ CRITICAL ERROR: Missing Supabase environment variables!')
  console.error('Required variables:')
  console.error('  - SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ MISSING')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ MISSING')
  console.error('\nPlease check your .env file or cPanel environment variables.')
  throw new Error('Missing Supabase environment variables')
}

// Backend client with SERVICE_ROLE_KEY (bypasses RLS, full access)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-supabase-role': 'service_role'
      }
    }
  }
)

// Auth client for token verification - use SERVICE_ROLE_KEY for server-side verification
export const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
