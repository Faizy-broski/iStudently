import { apiRequest, type ApiResponse } from "./index";

export interface Textbook {
  id: string;
  school_id: string;
  campus_id: string;
  grade_level_id: string;
  title: string;
  subject: string | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTextbookDTO {
  title: string;
  grade_level_id: string;
  subject?: string;
  stock_quantity?: number;
  campus_id?: string;
}

export interface UpdateTextbookDTO {
  title?: string;
  grade_level_id?: string;
  subject?: string;
  is_active?: boolean;
}

export function getTextbooks(params: {
  grade_level_id?: string;
  is_active?: boolean;
  campus_id?: string;
} = {}): Promise<ApiResponse<Textbook[]>> {
  const qs = new URLSearchParams();
  if (params.grade_level_id) qs.set("grade_level_id", params.grade_level_id);
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  if (params.campus_id) qs.set("campus_id", params.campus_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest<Textbook[]>(`/textbooks${suffix}`);
}

export function createTextbook(dto: CreateTextbookDTO): Promise<ApiResponse<Textbook>> {
  return apiRequest<Textbook>("/textbooks", { method: "POST", body: JSON.stringify(dto) });
}

export function updateTextbook(id: string, dto: UpdateTextbookDTO): Promise<ApiResponse<Textbook>> {
  return apiRequest<Textbook>(`/textbooks/${id}`, { method: "PUT", body: JSON.stringify(dto) });
}

export function deleteTextbook(id: string): Promise<ApiResponse<{ success: true }>> {
  return apiRequest(`/textbooks/${id}`, { method: "DELETE" });
}

export function restockTextbook(id: string, amount: number): Promise<ApiResponse<Textbook>> {
  return apiRequest<Textbook>(`/textbooks/${id}/restock`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}
