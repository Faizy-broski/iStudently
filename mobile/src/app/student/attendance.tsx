import { AttendanceView } from '@/features/portal/attendance-report';
import { portal, student } from '@/lib/api';

/** Daily summary (courses × dates P/A/L/E) or absence summary for a month (web: /student/attendance). */
export default function StudentAttendance() {
  return (
    <AttendanceView
      loadSummary={async (start, end) => {
        const r = await portal.studentAttendanceSummary(start, end);
        return { ...r, data: r.data?.[0] ?? null };
      }}
      loadMarks={async (month, year) => {
        const r = await student.getDetailedAttendance(month, year);
        return {
          ...r,
          data: (r.data ?? []).map((x) => ({ subject: x.timetable_entry.subject.name, period: x.timetable_entry.period.period_name, date: x.attendance_date, status: x.status })),
        };
      }}
    />
  );
}
