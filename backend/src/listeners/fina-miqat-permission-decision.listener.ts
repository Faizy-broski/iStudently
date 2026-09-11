// Spec §12: "Permission decision | Requester | On decision". Called from
// permissions.controller.ts's decide() after an admin approves/rejects a
// late-arrival/early-departure/full-day request.

import { notify } from '../services/fina/notifications.service';

export async function onMiqatPermissionDecided(
  schoolId: string,
  requesterProfileId: string,
  type: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  try {
    await notify({
      schoolId,
      userId: requesterProfileId,
      type: 'miqat_permission_decision',
      payload: { type, status },
      pushTitle: 'ميقات',
      pushBody: status === 'approved' ? `Your ${type.replace('_', ' ')} request was approved.` : `Your ${type.replace('_', ' ')} request was rejected.`,
    });
  } catch (err) {
    console.error('fina-miqat-permission-decision.listener failed (non-fatal, decision already saved):', err);
  }
}
