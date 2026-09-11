// Spec §12: "Marked absent (window closed) | Guardian | At window close,
// batched". Called from the nightly recompute job (miqat-nightly.job.ts)
// when a person's status for a date resolves to 'absent'.
//
// Known simplification, documented rather than silently claimed as
// spec-exact: the nightly job runs once, the following day, not at each
// school's own same-day late_cutoff_time — so this fires next-morning
// rather than at same-day window-close. Making it same-day would need a
// per-school scheduled check after each school's configured cutoff, which
// is a real follow-up, not implemented here.

import { supabase } from '../config/supabase';
import { getGuardianProfileIdsForPerson } from '../services/miqat/guardian-resolve';
import { notifyMany } from '../services/fina/notifications.service';

export async function onMiqatMarkedAbsent(schoolId: string, personId: string, date: string): Promise<void> {
  try {
    const guardianIds = await getGuardianProfileIdsForPerson(personId);
    if (guardianIds.length === 0) return;

    const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', personId).maybeSingle();
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'الطالب';

    await notifyMany(guardianIds, {
      schoolId,
      type: 'miqat_absence',
      payload: { personId, date },
      pushTitle: 'ميقات',
      pushBody: `${name} was not marked present at school on ${date}. If there is an excuse, please contact the school.`,
    });
  } catch (err) {
    console.error('fina-miqat-absence.listener failed (non-fatal, day record already saved):', err);
  }
}
