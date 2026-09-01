import { supabase } from '../config/supabase';
import { notificationProvider } from './notification-providers';

/**
 * Composes and "sends" (via the stub provider, see notification-providers/)
 * the parent notification for a delivered textbook (Phase 2 Feature 3),
 * called fire-and-forget from textbook-delivery.listener.ts.
 *
 * Compiles the student's FULL current list of delivered book titles — not
 * just the just-delivered one — so a parent gets one consolidated message
 * per delivery event rather than a flood of single-book texts.
 */
export async function notifyBookDelivered(schoolId: string, campusId: string, studentId: string): Promise<void> {
  const { data: student } = await supabase
    .from('students')
    .select('id, profile:profiles(first_name, last_name)')
    .eq('id', studentId)
    .maybeSingle();

  const studentName = [(student as any)?.profile?.first_name, (student as any)?.profile?.last_name]
    .filter(Boolean)
    .join(' ') || 'your child';

  const { data: rows } = await supabase
    .from('textbook_deliveries')
    .select('is_delivered, textbook:textbooks(title)')
    .eq('student_id', studentId);

  const deliveredTitles = (rows ?? [])
    .filter((r: any) => r.is_delivered)
    .map((r: any) => r.textbook?.title)
    .filter(Boolean);

  const messageBody = deliveredTitles.length
    ? `${studentName} has received the following textbooks: ${deliveredTitles.join(', ')}.`
    : `${studentName} has received a textbook.`;

  const recipient = await resolveParentPhone(studentId);

  const result = await notificationProvider.sendTextMessage(recipient ?? '', messageBody);

  await supabase.from('textbook_delivery_notifications').insert({
    school_id: schoolId,
    campus_id: campusId,
    student_id: studentId,
    channel: 'sms',
    recipient: recipient ?? null,
    message_body: messageBody,
    status: result.status === 'sent' ? 'sent' : 'failed',
    provider_response: result.response ?? null,
  });
}

/**
 * Resolves a parent's phone via parent_student_links -> parents -> profiles.phone,
 * the same join used by the active_parent_student_links view (schema.sql).
 * Best-effort — returns null (rather than throwing) if no active parent link
 * or phone number is found, since a missing phone must never block the
 * delivery write this is fired from.
 */
async function resolveParentPhone(studentId: string): Promise<string | null> {
  const { data } = await supabase
    .from('parent_student_links')
    .select('parent:parents(profile:profiles(phone))')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  return (data as any)?.parent?.profile?.phone ?? null;
}
