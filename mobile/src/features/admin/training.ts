import { env } from '@/lib/env';

// Shared by the training list and session screens (web: /admin/training).

export const STATUS_TONE: Record<string, string> = {
  open: 'bg-success-soft text-success  ',
  full: 'bg-destructive-soft text-destructive  ',
  closed: 'bg-muted text-muted-foreground  ',
};
export const capacityTone = (pct: number) => (pct >= 80 ? 'bg-destructive' : pct >= 50 ? 'bg-warning' : 'bg-success');
export const registrationLink = (token: string) => `${env.webUrl}/register/training/${token}`;
