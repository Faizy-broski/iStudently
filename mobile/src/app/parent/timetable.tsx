import type { TimetableEntry } from '@studently/api-client';
import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { TimetableView, type Entry } from '@/features/portal/timetable';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

const DAYS: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
const dayNumber = (d: number | string) => (typeof d === 'number' ? d : (DAYS[d.toLowerCase()] ?? (Number(d) || 1)));

/** The parent endpoint sends flat rows (subject_name, teacher_name, period_number); breaks are not classes. */
function toEntry(e: TimetableEntry): Entry {
  return {
    id: e.id,
    day_of_week: dayNumber(e.day_of_week),
    start_time: e.start_time,
    end_time: e.end_time,
    room_number: e.room_number,
    subject: { id: e.subject_name, name: e.subject_name, code: e.subject_code ?? '' },
    teacher: { id: e.teacher_name, profile: { first_name: e.teacher_name, last_name: '' } },
    period: { period_number: e.period_number, start_time: e.start_time, end_time: e.end_time },
  };
}

/** The selected child's weekly timetable (web: /parent/timetable). */
export default function ParentTimetable() {
  const { t } = useTranslation();
  const { child, childId } = useChild();
  const week = useApi(childId ? ['parent', 'timetable', childId] : null, ([, , id]) => parent.getTimetable(id as string));
  if (!child) return <NoChild />;
  const entries = (week.data ?? []).filter((e) => !e.is_break).map(toEntry);
  return (
    <TimetableView
      week={{ ...week, data: entries }}
      text={{ title: t('app.pa_tt_title'), subtitle: t('app.pa_tt_subtitle', { name: `${child.first_name} ${child.last_name}` }) }}
    />
  );
}
