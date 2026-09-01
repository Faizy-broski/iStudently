/**
 * Pluggable outbound text-message provider interface.
 *
 * No SMS/WhatsApp integration (Twilio, Ultramsg, or otherwise) exists
 * anywhere in this codebase yet — no package, no credentials. Rather than
 * blocking the textbook-delivery notification feature on procuring those,
 * this module ships a log-only default implementation that records what
 * *would* be sent. Swap the `notificationProvider` export for a real
 * Twilio/Ultramsg adapter later — every call site (textbook-notifications
 * .service.ts) is written against this interface and needs no changes.
 */
export interface NotificationProvider {
  sendTextMessage(to: string, body: string): Promise<{ status: 'sent' | 'failed'; response?: any }>;
}

class LogOnlyProvider implements NotificationProvider {
  async sendTextMessage(to: string, body: string) {
    console.log(`[notification-provider] (stub, not actually sent) to=${to || '(no recipient)'} body="${body}"`);
    return { status: 'sent' as const, response: { simulated: true } };
  }
}

export const notificationProvider: NotificationProvider = new LogOnlyProvider();
