import type { CurriculumNode } from '@studently/api-client';

import { locale } from '@/i18n';

/** Inline English/Arabic text, as the web's Qirtasi pages do (tt(en, ar)). */
export const tt = (en: string, ar: string) => (locale === 'ar' ? ar : en);

export const WORKSHEET_TYPES: { value: string; en: string; ar: string }[] = [
  { value: 'drill', en: 'Drill', ar: 'تدريب مهاري' },
  { value: 'enrichment', en: 'Enrichment', ar: 'إثرائي' },
  { value: 'diagnostic', en: 'Diagnostic', ar: 'تشخيصي' },
  { value: 'remedial', en: 'Remedial', ar: 'علاجي' },
  { value: 'lab_sheet', en: 'Lab Sheet', ar: 'ورقة مخبرية' },
  { value: 'flashcards', en: 'Flashcards', ar: 'بطاقات تعليمية' },
  { value: 'graphic_organizer', en: 'Graphic Organizer', ar: 'منظم بصري' },
  { value: 'project', en: 'Project', ar: 'مشروع' },
  { value: 'kindergarten', en: 'Kindergarten', ar: 'رياض أطفال' },
  { value: 'handwriting', en: 'Handwriting', ar: 'خط ويد' },
  { value: 'quiz', en: 'Quiz', ar: 'اختبار قصير' },
  { value: 'unit_review', en: 'Unit Review', ar: 'مراجعة وحدة' },
  { value: 'family_activity', en: 'Family Activity', ar: 'نشاط أسري' },
];
export const TYPE_MAP = Object.fromEntries(WORKSHEET_TYPES.map((t) => [t.value, t]));

/** Facets shown as filter chips in the library. */
export const FILTER_FACET_KEYS = ['purpose', 'blooms_level', 'difficulty', 'grouping', 'duration_minutes', 'print_mode', 'accessibility'];
/** Facets taggable on upload (adds approval_state). */
export const TAG_FACET_KEYS = [...FILTER_FACET_KEYS, 'approval_state'];

export const nodeLabel = (n: CurriculumNode) => (locale === 'ar' ? n.name_ar : n.name_en) || n.name_ar;
