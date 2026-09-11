// Anti-spam rule (spec §12): a guardian with three children must receive
// ONE consolidated arrival notification, not three. Batched per guardian per
// 60-second window, then flushed as a single Al-Fina' notification.
//
// In-memory, per-process — same tradeoff already accepted elsewhere in this
// codebase for small, short-lived state (see TtlCache's doc comment): on a
// multi-instance deployment each instance batches independently, which just
// means a guardian could occasionally get two notifications instead of one
// rather than a wrong or lost one. Acceptable; not worth a distributed queue
// for this.

import { notify } from '../fina/notifications.service';

export interface GateNotifyItem {
  schoolId: string;
  studentName: string;
  kind: 'check_in' | 'check_out' | 'late_arrival' | 'early_departure';
  collectorName?: string; // early_departure only — spec §8.4 child-safety requirement
}

const WINDOW_MS = 60_000;
const buffers = new Map<string, { items: GateNotifyItem[]; timer: ReturnType<typeof setTimeout> }>();

export function batchNotifyGuardian(guardianProfileId: string, item: GateNotifyItem): void {
  let buf = buffers.get(guardianProfileId);
  if (!buf) {
    buf = { items: [], timer: setTimeout(() => void flush(guardianProfileId), WINDOW_MS) };
    buffers.set(guardianProfileId, buf);
  }
  buf.items.push(item);
}

const KIND_LABEL: Record<GateNotifyItem['kind'], string> = {
  check_in: 'arrived at school',
  check_out: 'left school',
  late_arrival: 'arrived late',
  early_departure: 'left school early',
};

async function flush(guardianProfileId: string): Promise<void> {
  const buf = buffers.get(guardianProfileId);
  buffers.delete(guardianProfileId);
  if (!buf || buf.items.length === 0) return;

  try {
    const schoolId = buf.items[0].schoolId;
    const body =
      buf.items.length === 1
        ? `${buf.items[0].studentName} ${KIND_LABEL[buf.items[0].kind]}.${
            buf.items[0].collectorName ? ` Collected by: ${buf.items[0].collectorName}.` : ''
          }`
        : `Attendance update: ${buf.items.map((i) => `${i.studentName} ${KIND_LABEL[i.kind]}`).join('; ')}.`;

    await notify({
      schoolId,
      userId: guardianProfileId,
      type: 'miqat_attendance',
      payload: { items: buf.items },
      pushTitle: 'ميقات',
      pushBody: body,
    });
  } catch (err) {
    console.error('guardian-batch-notify flush failed:', err);
  }
}
