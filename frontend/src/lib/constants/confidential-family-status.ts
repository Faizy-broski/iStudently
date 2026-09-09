export type ConfidentialFamilyStatus =
  | 'NONE'
  | 'PARENTS_DIVORCED'
  | 'ORPHAN_FATHER'
  | 'ORPHAN_MOTHER'
  | 'ORPHAN_BOTH';

export interface ConfidentialFamilyStatusOption {
  value: ConfidentialFamilyStatus;
  label: {
    en: string;
    ar: string;
  };
  badgeLabel: {
    en: string;
    ar: string;
  };
  description?: {
    en: string;
    ar: string;
  };
}

export const CONFIDENTIAL_FAMILY_STATUS_OPTIONS: ConfidentialFamilyStatusOption[] = [
  {
    value: 'NONE',
    label: {
      en: 'Normal / None',
      ar: 'عادي / لا يوجد'
    },
    badgeLabel: {
      en: '',
      ar: ''
    },
    description: {
      en: 'No confidential family status recorded',
      ar: 'لا توجد حالة عائلية سرية مسجلة'
    }
  },
  {
    value: 'PARENTS_DIVORCED',
    label: {
      en: 'Parents Divorced',
      ar: 'الوالدان منفصلان'
    },
    badgeLabel: {
      en: 'Parents Divorced',
      ar: 'الوالدان منفصلان'
    },
    description: {
      en: 'Parents are divorced or legally separated',
      ar: 'الوالدان منفصلان أو مطلقان'
    }
  },
  {
    value: 'ORPHAN_FATHER',
    label: {
      en: 'Orphan (Father)',
      ar: 'يتيم الأب'
    },
    badgeLabel: {
      en: 'Orphan (Father)',
      ar: 'يتيم الأب'
    },
    description: {
      en: 'Deceased father',
      ar: 'الأب متوفى'
    }
  },
  {
    value: 'ORPHAN_MOTHER',
    label: {
      en: 'Orphan (Mother)',
      ar: 'يتيم الأم'
    },
    badgeLabel: {
      en: 'Orphan (Mother)',
      ar: 'يتيم الأم'
    },
    description: {
      en: 'Deceased mother',
      ar: 'الأم متوفاة'
    }
  },
  {
    value: 'ORPHAN_BOTH',
    label: {
      en: 'Orphan (Both Parents)',
      ar: 'يتيم الأبوين'
    },
    badgeLabel: {
      en: 'Orphan (Both Parents)',
      ar: 'يتيم الأبوين'
    },
    description: {
      en: 'Both parents are deceased',
      ar: 'كلا الوالدين متوفيان'
    }
  }
];

export function getConfidentialFamilyStatusLabel(
  status: ConfidentialFamilyStatus | string | null | undefined,
  locale: string = 'en'
): string {
  if (!status || status === 'NONE') return '';
  const opt = CONFIDENTIAL_FAMILY_STATUS_OPTIONS.find(o => o.value === status);
  if (!opt) return status;
  return locale === 'ar' ? opt.badgeLabel.ar : opt.badgeLabel.en;
}

export function isConfidentialFamilyStatusActive(
  status: ConfidentialFamilyStatus | string | null | undefined
): boolean {
  return !!status && status !== 'NONE';
}

export function canReadConfidentialFamilyStatus(role?: string | null): boolean {
  if (!role) return false;
  return ['admin', 'super_admin', 'counselor', 'teacher'].includes(role);
}

export function canWriteConfidentialFamilyStatus(role?: string | null): boolean {
  if (!role) return false;
  return ['admin', 'super_admin', 'counselor'].includes(role);
}
