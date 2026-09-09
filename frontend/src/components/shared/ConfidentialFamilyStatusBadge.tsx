'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useLocale } from 'next-intl';
import {
  ConfidentialFamilyStatus,
  getConfidentialFamilyStatusLabel,
  isConfidentialFamilyStatusActive
} from '@/lib/constants/confidential-family-status';

interface ConfidentialFamilyStatusBadgeProps {
  status?: ConfidentialFamilyStatus | string | null;
  locale?: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Renders a confidential family status badge (🔒 [Label]).
 * Returns null if status is 'NONE' or null/undefined.
 * Safe for all staff surfaces (Admin roster, Teacher class list, Attendance, ID Card).
 */
export function ConfidentialFamilyStatusBadge({
  status,
  locale: propLocale,
  className = '',
  showIcon = true
}: ConfidentialFamilyStatusBadgeProps) {
  const currentLocale = useLocale();
  const effectiveLocale = propLocale || currentLocale;

  if (!isConfidentialFamilyStatusActive(status)) {
    return null;
  }

  const label = getConfidentialFamilyStatusLabel(status, effectiveLocale);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shrink-0 select-none ${className}`}
      title={label}
    >
      {showIcon && <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

export default ConfidentialFamilyStatusBadge;
