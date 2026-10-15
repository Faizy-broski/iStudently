import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { AttendanceView, type AttendanceMark } from '@/features/portal/attendance-report';
import { parent, portal } from '@/lib/api';

type Raw = { timetable_entry?: { subject?: { name?: string }; period?: { period_name?: string } }; subject?: string; period?: string; attendance_date?: string; date?: string; status?: string };

/** The selected child's daily summary or absence summary for a month (web: /parent/attendance). */
export default function ParentAttendance() {
  const { t } = useTranslation();
  const { child } = useChild();
  if (!child) return <NoChild />;
  const childId = child.id;
  return (
    <AttendanceView
      key={childId}
      subtitle={`${child.first_name} ${child.last_name}`}
      fullTable
      loadSummary={async (start, end) => {
        const r = await portal.parentAttendanceSummary(start, end);
        const rows = r.data ?? [];
        return { ...r, data: rows.find((x) => x.student_id === childId) ?? rows[0] ?? null };
      }}
      loadMarks={async (month, year) => {
        const r = await parent.getDetailedAttendance(childId, month, year);
        // Web: the endpoint may send timetable_entry.subject/period or flat subject/period/date.
        const marks: AttendanceMark[] = ((r.data ?? []) as Raw[]).flatMap((x) => {
          const date = x.attendance_date ?? x.date;
          return date ? [{ subject: x.timetable_entry?.subject?.name ?? x.subject ?? t('app.pa_at_unknown'), period: x.timetable_entry?.period?.period_name ?? x.period ?? '', date, status: x.status ?? '' }] : [];
        });
        return { ...r, data: marks };
      }}
    />
  );
}
