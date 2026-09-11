import { supabase } from '../../config/supabase';
import { getGuardianProfileIdsForStudent } from '../fina/access-policy.service';

/**
 * Miqat's person_id is a profiles.id (it identifies whoever's card was
 * scanned); Al-Fina's guardian lookup is keyed by students.id. This bridges
 * the two — returns [] for a person with no students row (i.e. staff, not
 * a student), which callers treat as "no guardian to notify," not an error.
 */
export async function getGuardianProfileIdsForPerson(personProfileId: string): Promise<string[]> {
  const { data: student, error } = await supabase.from('students').select('id').eq('profile_id', personProfileId).maybeSingle();
  if (error || !student) return [];
  return getGuardianProfileIdsForStudent(student.id);
}
