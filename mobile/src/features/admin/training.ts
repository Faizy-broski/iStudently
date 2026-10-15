import { env } from '@/lib/env';

// Shared by the training list and session screens (web: /admin/training).

export const STATUS_TONE: Record<string, string> = {
  open: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
  full: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};
export const capacityTone = (pct: number) => (pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-green-500');
export const registrationLink = (token: string) => `${env.webUrl}/register/training/${token}`;
