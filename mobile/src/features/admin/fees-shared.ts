import type { PeriodType } from '@studently/api-client';

/** Period type -> key in the web's `fees.structures` strings. */
export const PERIOD_KEY: Record<PeriodType, string> = { monthly: 'monthly', termly: 'termly', quarterly: 'quarterly', semester: 'semester', annual: 'annual', one_time: 'oneTime' };
export const PERIOD_TYPES = Object.keys(PERIOD_KEY) as PeriodType[];
/** Types where a grade has several structures (Term 1, Term 2, ...), so a period number is required. */
export const MULTI_INSTANCE_PERIODS: PeriodType[] = ['termly', 'quarterly', 'semester'];
