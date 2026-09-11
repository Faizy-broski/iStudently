// Spec §12: "Escalation threshold crossed | Guardian + admin | Nightly job".
// Called from the nightly recompute job (miqat-nightly.job.ts) once per
// person whose accumulated lateness/consecutive-late/rolling-week figures
// cross a configured threshold (attendance-engine.ts's checkEscalationTriggers).

import { supabase } from '../config/supabase';
import { getGuardianProfileIdsForPerson } from '../services/miqat/guardian-resolve';
import { notify, notifyMany } from '../services/fina/notifications.service';
import { EscalationTrigger } from '../services/miqat/attendance-engine';

const TRIGGER_LABEL: Record<EscalationTrigger, string> = {
  CONSECUTIVE_LATE_DAYS: 'has been late several days in a row',
  LATENESS_IN_ROLLING_WEEK: 'has multiple late arrivals this week',
  ACCUMULATED_LATENESS_THRESHOLD: 'has crossed the accumulated lateness threshold',
};

export async function onMiqatEscalationTriggered(schoolId: string, personId: string, triggers: EscalationTrigger[]): Promise<void> {
  if (triggers.length === 0) return;
  try {
    const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', personId).maybeSingle();
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'الطالب';
    const body = `${name} ${triggers.map((t) => TRIGGER_LABEL[t]).join('; ')}.`;

    const guardianIds = await getGuardianProfileIdsForPerson(personId);
    if (guardianIds.length > 0) {
      await notifyMany(guardianIds, { schoolId, type: 'miqat_escalation', payload: { personId, triggers }, pushTitle: 'ميقات', pushBody: body });
    }

    const { data: admins } = await supabase.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'admin');
    await Promise.all(
      (admins || []).map((a) =>
        notify({ schoolId, userId: a.id, type: 'miqat_escalation', payload: { personId, triggers }, pushTitle: 'ميقات', pushBody: body })
      )
    );
  } catch (err) {
    console.error('fina-miqat-escalation.listener failed (non-fatal):', err);
  }
}
