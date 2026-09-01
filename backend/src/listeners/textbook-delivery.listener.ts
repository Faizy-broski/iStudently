import { textbooksService } from '../services/textbooks.service';
import { notifyBookDelivered } from '../services/textbook-notifications.service';

/**
 * Fire-and-forget side effects for a textbook delivery, called from
 * textbook-deliveries.service.ts's syncDelivery/bulkSyncDelivery exactly once
 * per (student_id, book_id) that just flipped is_delivered false->true.
 *
 * Deliberately isolated in its own file, same shape as
 * fina-attendance-absence.listener.ts: every internal error is caught here
 * and never re-thrown, and the two side effects (stock decrement,
 * notification) are isolated from each other — a failure in one must never
 * undo the delivery record already written, nor prevent the other side
 * effect from running.
 */
export async function onTextbookDelivered(
  schoolId: string,
  campusId: string,
  bookId: string,
  studentId: string
): Promise<void> {
  try {
    await textbooksService.decrementTextbookStock(bookId);
  } catch (err) {
    console.error('textbook-delivery.listener: stock decrement failed (non-fatal):', err);
  }

  try {
    await notifyBookDelivered(schoolId, campusId, studentId);
  } catch (err) {
    console.error('textbook-delivery.listener: notification failed (non-fatal):', err);
  }
}
