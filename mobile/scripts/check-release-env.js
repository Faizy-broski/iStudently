#!/usr/bin/env node
// EAS build hook (package.json "eas-build-post-install"): stop a production build that would ship
// with missing or unsafe public settings. Development and preview builds are not checked.
const profile = process.env.EAS_BUILD_PROFILE
if (profile !== 'production') process.exit(0)

const problems = []
const need = (name) => {
  const v = process.env[name]
  if (!v) problems.push(`${name} is not set`)
  return v || ''
}
const api = need('EXPO_PUBLIC_API_URL')
const supabase = need('EXPO_PUBLIC_SUPABASE_URL')
need('EXPO_PUBLIC_SUPABASE_ANON_KEY')
const web = process.env.EXPO_PUBLIC_WEB_URL || 'https://istudent.ly'
for (const [name, url] of [['EXPO_PUBLIC_API_URL', api], ['EXPO_PUBLIC_SUPABASE_URL', supabase], ['EXPO_PUBLIC_WEB_URL', web]]) {
  if (url && !/^https:\/\//.test(url)) problems.push(`${name} must be an https:// address (got ${url})`)
  if (/localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\./.test(url)) problems.push(`${name} points at a local address (${url})`)
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  problems.push('A Supabase service-role key is present in the build environment; remove it')
}
if (problems.length) {
  console.error(`\nRelease environment check failed:\n- ${problems.join('\n- ')}\n`)
  process.exit(1)
}
console.log('Release environment check passed.')
