// Textbooks: per-grade titles with stock, and who received / returned them.
// Same endpoints as frontend/src/lib/api/textbooks.ts + textbook-deliveries.ts;
// routers: textbooks.routes.ts, textbook-deliveries.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface Textbook {
  id: string
  school_id: string
  campus_id: string
  grade_level_id: string
  title: string
  subject: string | null
  stock_quantity: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TextbookCondition = 'new' | 'good' | 'damaged'

export interface TextbookDelivery {
  id: string
  student_id: string
  book_id: string
  is_delivered: boolean
  delivered_at: string | null
  return_status: 'pending' | 'returned' | 'lost'
  condition: TextbookCondition | null
}

export interface DeliveryMatrix {
  section: { id: string; name: string; grade_level_id: string } | null
  books: Textbook[]
  students: { id: string; student_number: string; name: string; has_overdue_payments: boolean; deliveries: Record<string, TextbookDelivery | null> }[]
}

export interface DeliverySyncItem {
  student_id: string
  book_id: string
  is_delivered: boolean
  condition?: TextbookCondition
}

export interface MissingSummary {
  by_book: { book_id: string; title: string; grade_level_name: string | null; total_students: number; missing_count: number }[]
  by_section: { section_id: string; section_name: string; total_students: number; missing_count: number }[]
}

export function adminTextbooksApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (f: { grade_level_id?: string; is_active?: boolean; campus_id?: string } = {}) =>
      api.get<Textbook[]>(`/textbooks${qs({ grade_level_id: f.grade_level_id, is_active: f.is_active === undefined ? undefined : String(f.is_active), campus_id: f.campus_id })}`),
    create: (body: { title: string; grade_level_id: string; subject?: string; stock_quantity?: number; campus_id?: string }) => api.post<Textbook>('/textbooks', body),
    update: (textbookId: string, body: { title?: string; grade_level_id?: string; subject?: string; is_active?: boolean }) => api.put<Textbook>(`/textbooks/${id(textbookId)}`, body),
    remove: (textbookId: string) => api.del<void>(`/textbooks/${id(textbookId)}`),
    restock: (textbookId: string, amount: number) => api.post<Textbook>(`/textbooks/${id(textbookId)}/restock`, { amount }),

    matrix: (f: { section_id?: string; grade_level_id?: string; campus_id?: string }) => api.get<DeliveryMatrix>(`/textbook-deliveries/matrix${qs(f)}`),
    /** `code` on failure explains a block (e.g. overdue payments; resend with override). */
    sync: (item: DeliverySyncItem & { override?: boolean }) => api.post<TextbookDelivery>('/textbook-deliveries/sync', item),
    bulkSync: (items: DeliverySyncItem[], override?: boolean) =>
      api.post<{ updated: TextbookDelivery[]; blocked: { student_id: string; book_id: string; reason: string }[] }>('/textbook-deliveries/bulk-sync', { items, override }),
    returnDelivery: (deliveryId: string, body: { return_status: 'returned' | 'lost'; condition?: TextbookCondition; notes?: string }) =>
      api.post<TextbookDelivery>(`/textbook-deliveries/${id(deliveryId)}/return`, body),
    bulkReturn: (items: { id: string; return_status: 'returned' | 'lost'; condition?: TextbookCondition; notes?: string }[]) =>
      api.post<TextbookDelivery[]>('/textbook-deliveries/bulk-return', { items }),
    missingSummary: (campusId?: string) => api.get<MissingSummary>(`/textbook-deliveries/missing-summary${qs({ campus_id: campusId })}`),
  }
}
