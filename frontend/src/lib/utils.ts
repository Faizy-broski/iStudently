import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Library utility functions
export function formatFullName(profile?: {
  first_name?: string | null;
  father_name?: string | null;
  last_name?: string | null;
} | null): string {
  if (!profile) return '';
  const parts = [profile.first_name, profile.father_name, profile.last_name].filter(Boolean);
  return parts.join(' ');
}

export interface LoanStatus {
  status: string;
  color: string;
  isOverdue: boolean;
}

/**
 * Get the display status for a loan, accounting for overdue status
 * This handles the case where database triggers don't update status automatically
 */
export function getLoanDisplayStatus(loan: {
  status: string;
  due_date: string;
}): LoanStatus {
  const now = new Date();
  const dueDate = new Date(loan.due_date);
  const isOverdue = loan.status === 'active' && dueDate < now;

  if (isOverdue) {
    return {
      status: 'overdue',
      color: 'destructive', // Red color in shadcn/ui
      isOverdue: true
    };
  }

  // Map database status to display status and color
  const statusMap: Record<string, { status: string; color: string }> = {
    active: { status: 'active', color: 'default' },
    returned: { status: 'returned', color: 'secondary' },
    overdue: { status: 'overdue', color: 'destructive' },
    lost: { status: 'lost', color: 'destructive' }
  };

  return {
    ...statusMap[loan.status] || { status: loan.status, color: 'default' },
    isOverdue: false
  };
}

/**
 * Calculate days overdue for a loan
 */
export function getDaysOverdue(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Format overdue message
 */
export function getOverdueMessage(dueDate: string): string {
  const days = getDaysOverdue(dueDate);
  if (days === 0) return '';
  if (days === 1) return '1 day overdue';
  return `${days} days overdue`;
}
