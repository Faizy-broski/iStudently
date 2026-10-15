import Storage from 'expo-sqlite/kv-store';

import { setDatePattern } from '@/lib/format';

/** Super admin "Preferred date format" (web: saved in the browser; here: on the device, per user). */
const key = (userId: string) => `superadmin.date_format.${userId}`;

export function loadDateFormat(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try {
    return Storage.getItemSync(key(userId));
  } catch {
    return null;
  }
}

export function saveDateFormat(userId: string, pattern: string) {
  Storage.setItemSync(key(userId), pattern);
  setDatePattern(pattern);
}
