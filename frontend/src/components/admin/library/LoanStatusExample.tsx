// Example: How to use loan status utilities in your components

import { getLoanDisplayStatus, getDaysOverdue, getOverdueMessage } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Example loan data from API
const exampleLoan = {
  id: 'loan-123',
  status: 'active', // This might be stale in the database
  due_date: '2024-01-10', // Past due date
  student_name: 'John Doe',
  book_title: 'Sample Book'
};

// In your component
export function LoanStatusExample() {
  const loanStatus = getLoanDisplayStatus(exampleLoan);
  const daysOverdue = getDaysOverdue(exampleLoan.due_date);
  const overdueMessage = getOverdueMessage(exampleLoan.due_date);

  return (
    <div className="space-y-2">
      {/* Status Badge */}
      <Badge variant={loanStatus.color as any}>
        {loanStatus.status.toUpperCase()}
      </Badge>

      {/* Overdue Information */}
      {loanStatus.isOverdue && (
        <div className="text-sm text-red-600">
          ⚠️ {overdueMessage}
        </div>
      )}

      {/* Additional loan details */}
      <div className="text-sm">
        <p>Student: {exampleLoan.student_name}</p>
        <p>Book: {exampleLoan.book_title}</p>
        <p>Due: {new Date(exampleLoan.due_date).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

// Example usage in a table or list
export function LoanRow({ loan }: { loan: typeof exampleLoan }) {
  const displayStatus = getLoanDisplayStatus(loan);

  return (
    <tr className={displayStatus.isOverdue ? 'bg-red-50' : ''}>
      <td>{loan.student_name}</td>
      <td>{loan.book_title}</td>
      <td>
        <Badge variant={displayStatus.color as any}>
          {displayStatus.status}
        </Badge>
      </td>
      <td>
        {displayStatus.isOverdue && (
          <span className="text-red-600 text-sm">
            {getOverdueMessage(loan.due_date)}
          </span>
        )}
      </td>
    </tr>
  );
}