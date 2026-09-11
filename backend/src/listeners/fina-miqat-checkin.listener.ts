// Event-driven hook (spec §12): student check-in/check-out/late-arrival/
// early-departure, all immediate (batched only for the anti-spam 60s
// multi-child consolidation — see guardian-batch-notify.ts). Called directly
// from attendance.controller.ts's batch()/manual() write paths at the
// moment an event is accepted, fire-and-forget with every internal error
// caught here — a bug in Al-Fina' must never break attendance recording,
// which this listener only observes. Mirrors
// fina-attendance-absence.listener.ts's isolation convention exactly.

import { supabase } from '../config/supabase';
import { getGuardianProfileIdsForPerson } from '../services/miqat/guardian-resolve';
import { batchNotifyGuardian, GateNotifyItem } from '../services/miqat/guardian-batch-notify';

async function resolveStudentName(personId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('first_name, last_name').eq('id', personId).maybeSingle();
  if (!data) return null;
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
}

export async function onMiqatGateEvent(
  schoolId: string,
  personId: string,
  kind: GateNotifyItem['kind'],
  collectorName?: string
): Promise<void> {
  try {
    const guardianIds = await getGuardianProfileIdsForPerson(personId);
    if (guardianIds.length === 0) return; // staff person — no guardian notification path here

    const studentName = await resolveStudentName(personId);
    if (!studentName) return;

    for (const guardianId of guardianIds) {
      batchNotifyGuardian(guardianId, { schoolId, studentName, kind, collectorName });
    }
  } catch (err) {
    console.error('fina-miqat-checkin.listener failed (non-fatal, event already recorded):', err);
  }
}
