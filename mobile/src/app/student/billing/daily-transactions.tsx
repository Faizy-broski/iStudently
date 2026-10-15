import { DailyTransactionsView } from '@/features/portal/daily-transactions';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The student's payments of one month, grouped by day (web: /student/billing/daily-transactions). */
export default function StudentDailyTransactions() {
  const data = useApi(['student', 'payments'], () => student.getStudentPaymentHistory());
  return <DailyTransactionsView data={data} />;
}
