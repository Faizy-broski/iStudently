import { TimetableView, type Entry } from '@/features/portal/timetable';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Week grid and day list of the student's timetable (web: /student/timetable). */
export default function StudentTimetable() {
  const week = useApi(['student', 'timetable-week'], () => student.getWeeklyTimetable());
  return <TimetableView week={{ ...week, data: week.data as Entry[] | undefined }} />;
}
