function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy mobile/.env.example to mobile/.env.`)
  return value.replace(/\/$/, '')
}

// EXPO_PUBLIC_* must be referenced literally so Expo inlines them at build time.
export const env = {
  apiUrl: required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  /** The web app, for roles and steps that stay on the website. */
  webUrl: (process.env.EXPO_PUBLIC_WEB_URL || 'https://istudent.ly').replace(/\/$/, ''),
}
