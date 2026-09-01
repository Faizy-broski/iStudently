import { apiRequest, type ApiResponse } from "./index";
import type { Textbook } from "./textbooks";

export interface DeliveryRecord {
  id: string;
  student_id: string;
  book_id: string;
  is_delivered: boolean;
  delivered_at: string | null;
  return_status: "pending" | "returned" | "lost";
  condition: "new" | "good" | "damaged" | null;
}

export interface MatrixStudent {
  id: string;
  student_number: string;
  name: string;
  has_overdue_payments: boolean;
  deliveries: Record<string, DeliveryRecord | null>;
}

export interface DeliveryMatrix {
  section: { id: string; name: string; grade_level_id: string } | null;
  books: Textbook[];
  students: MatrixStudent[];
}

export interface SyncItem {
  student_id: string;
  book_id: string;
  is_delivered: boolean;
  condition?: "new" | "good" | "damaged";
}

export interface BulkSyncResult {
  updated: DeliveryRecord[];
  blocked: Array<{ student_id: string; book_id: string; reason: string }>;
}

export function getDeliveryMatrix(params: {
  section_id?: string;
  grade_level_id?: string;
  campus_id?: string;
}): Promise<ApiResponse<DeliveryMatrix>> {
  const qs = new URLSearchParams();
  if (params.section_id) qs.set("section_id", params.section_id);
  if (params.grade_level_id) qs.set("grade_level_id", params.grade_level_id);
  if (params.campus_id) qs.set("campus_id", params.campus_id);
  return apiRequest<DeliveryMatrix>(`/textbook-deliveries/matrix?${qs.toString()}`);
}

export function syncDelivery(
  item: SyncItem & { override?: boolean }
): Promise<ApiResponse<DeliveryRecord> & { code?: string }> {
  return apiRequest<DeliveryRecord>(`/textbook-deliveries/sync`, {
    method: "POST",
    body: JSON.stringify(item),
  }) as Promise<ApiResponse<DeliveryRecord> & { code?: string }>;
}

export function bulkSyncDelivery(
  items: SyncItem[],
  override?: boolean
): Promise<ApiResponse<BulkSyncResult>> {
  return apiRequest<BulkSyncResult>(`/textbook-deliveries/bulk-sync`, {
    method: "POST",
    body: JSON.stringify({ items, override }),
  });
}

export function returnDelivery(
  id: string,
  payload: { return_status: "returned" | "lost"; condition?: "new" | "good" | "damaged"; notes?: string }
): Promise<ApiResponse<DeliveryRecord>> {
  return apiRequest<DeliveryRecord>(`/textbook-deliveries/${id}/return`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function bulkReturnDelivery(
  items: Array<{ id: string; return_status: "returned" | "lost"; condition?: "new" | "good" | "damaged"; notes?: string }>
): Promise<ApiResponse<DeliveryRecord[]>> {
  return apiRequest<DeliveryRecord[]>(`/textbook-deliveries/bulk-return`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export interface MissingSummary {
  by_book: Array<{ book_id: string; title: string; grade_level_name: string | null; total_students: number; missing_count: number }>;
  by_section: Array<{ section_id: string; section_name: string; total_students: number; missing_count: number }>;
}

export function getMissingSummary(campus_id?: string): Promise<ApiResponse<MissingSummary>> {
  const suffix = campus_id ? `?campus_id=${campus_id}` : "";
  return apiRequest<MissingSummary>(`/textbook-deliveries/missing-summary${suffix}`);
}
