import type { LessonPlan } from '@studently/api-client';

import { ymd } from '@/components/app/date-field';

type Cp = LessonPlan['course_period'];

/** "Course — Section — P1" (web: formatCoursePeriodLabel). */
export function lessonCpLabel(cp: Cp, unknown: string) {
  if (!cp) return unknown;
  const parts = [cp.course?.title, cp.section?.name, cp.period?.short_name ? `P${cp.period.short_name}` : null].filter(Boolean);
  return parts.join(' — ') || cp.title || unknown;
}

export function lessonTeacherName(cp: Cp, lesson?: Pick<LessonPlan, 'teacher'>) {
  const p = lesson?.teacher?.profile || cp?.teacher?.profile;
  return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '—';
}

// Local dates (the web's toISOString can shift a day east of UTC).
const iso = ymd;

/** Monday–Sunday around `date` (web: getWeekRange). */
export function weekRange(date: Date) {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { date_from: iso(monday), date_to: iso(sunday) };
}

export function monthRange(date: Date) {
  return { date_from: iso(new Date(date.getFullYear(), date.getMonth(), 1)), date_to: iso(new Date(date.getFullYear(), date.getMonth() + 1, 0)) };
}

export function lessonDate(value: string, locale: string) {
  const [y, m, d] = value.substring(0, 10).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
