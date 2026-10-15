import { useCampus } from '@/features/campus/campus';
import { PrintStatementsView } from '@/features/portal/print-statements';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Billing statement: totals, invoices and payments, printable (web: /student/billing/print-statements). */
export default function StudentPrintStatements() {
  const { campus } = useCampus();
  const fees = useApi(['student', 'fees'], () => student.getStudentFees());
  const payments = useApi(['student', 'payments'], () => student.getStudentPaymentHistory());
  return <PrintStatementsView fees={fees} payments={payments} school={campus?.name ?? ''} />;
}
