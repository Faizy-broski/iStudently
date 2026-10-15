import { supabase } from '../config/supabase'

/** Escapes LIKE wildcards so `ilike` is a case-insensitive exact match ("a%" no longer matches "admin"). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Email of the active profile with this username (case-insensitive, exact), or null. */
export async function resolveUsernameEmail(username: string): Promise<string | null> {
  const name = username.trim()
  if (!name || name.length > 100) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .ilike('username', escapeLike(name))
    .eq('is_active', true)
    .limit(2)
  // Two rows means the username is ambiguous; refuse rather than pick one.
  if (error || !data || data.length !== 1 || !data[0]?.email) return null
  return data[0].email
}
