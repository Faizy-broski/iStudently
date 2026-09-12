// Spec §14: "A full week with zero lateness credits the student an amount
// in Nuqra." Miqat publishes this as an event; Mizan (this listener) is the
// only thing that ever writes into mizan_* tables — Miqat's nightly job
// never touches Mizan's ledger directly (see the plan's stated boundary).
// Disabled by default per school (policy_json.mizan_rewards_enabled), and
// weighted toward positive reinforcement per the spec's own product note —
// there is deliberately no punitive-lateness counterpart here.

import { mizanService } from '../services/mizan/mizan.service';

const DEFAULT_WEEKLY_NUQRA = 5;

export async function onAttendanceStreakAchieved(
  schoolId: string,
  personId: string,
  streakType: 'zero_lateness_week',
  amount: number = DEFAULT_WEEKLY_NUQRA
): Promise<void> {
  try {
    await mizanService.creditNuqra(personId, schoolId, amount, `miqat_${streakType}`, `${personId}:${streakType}:${new Date().toISOString().slice(0, 10)}`);
  } catch (err) {
    console.error('mizan-miqat-streak.listener failed (non-fatal, attendance record already saved):', err);
  }
}
