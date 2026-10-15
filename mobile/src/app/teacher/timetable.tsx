import { useTranslation } from 'react-i18next';

import { useSession } from '@/features/auth/session';
import { usePortalAcademic } from '@/features/portal/academic';
import { TimetableView, type Entry } from '@/features/portal/timetable';
import { adminTimetable } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The teacher's weekly timetable: week grid and day list with section and room (web: /teacher/timetable). */
export default function TeacherTimetable() {
  const { t } = useTranslation();
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const academic = usePortalAcademic();
  const yearId = academic.year?.id ?? null;
  const res = useApi(staffId && yearId ? ['teacher', 'timetable', staffId, yearId] : null, ([, , s, y]) => adminTimetable.teacherTimetable(s as string, y as string));
  const entries: Entry[] = (res.data ?? [])
    .filter((e) => !e.period?.is_break)
    .map((e) => {
      const section = e.section?.name ?? e.section_name ?? '';
      const grade = e.section?.grade_level?.name ?? e.grade_name ?? '';
      const subject = e.subject?.name ?? e.subject_name ?? '';
      return {
        id: e.id,
        // Web: day_of_week 0 = Monday; the view uses 1 = Monday … 7 = Sunday.
        day_of_week: (e.day_of_week % 7) + 1,
        start_time: e.period?.start_time ?? '',
        end_time: e.period?.end_time ?? '',
        room_number: e.room_number ?? '',
        subject: { id: e.subject_id, name: subject, code: e.subject?.code ?? '' },
        teacher: { id: '', profile: { first_name: '', last_name: '' } },
        period: { period_number: e.period?.period_number, start_time: e.period?.start_time, end_time: e.period?.end_time },
        subtitle: [section, grade].filter(Boolean).join(' • '),
      };
    });
  return (
    <TimetableView
      week={{ data: entries, isLoading: res.isLoading || academic.isLoading, error: res.error, mutate: res.mutate }}
      text={{ title: t('teacherPages.timetable.pageTitle'), subtitle: academic.year ? t('teacherPages.timetable.subtitleWithYear', { year: academic.year.name }) : t('teacherPages.timetable.subtitle') }}
    />
  );
}
