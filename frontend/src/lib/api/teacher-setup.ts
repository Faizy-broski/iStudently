"use client";

import { apiRequest } from "./index";
import type { GradingScale, GradingScaleGrade } from "./grades";

// ─── Re-export types used by teacher setup hooks ─────────────────────────────

export type { GradingScale, GradingScaleGrade };

export interface TeacherCommentCode {
  id: string;
  scale_id: string;
  school_id: string;
  staff_id: string | null;
  title: string;
  short_name: string | null;
  comment: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface TeacherCommentCodeScale {
  id: string;
  school_id: string;
  staff_id: string | null; // null = school-wide (read-only for teacher)
  title: string;
  comment: string | null;
  sort_order: number;
  is_active: boolean;
  codes?: TeacherCommentCode[];
}

export interface TeacherGradebookConfig {
  assignment_sorting: "due_date" | "assigned_date" | "title" | "points";
  weight_assignment_types: boolean;
  weight_assignments: boolean;
  default_assigned_date: boolean;
  default_due_date: boolean;
  anomalous_max: number;
  latency: number | null;
}

// ─── Grading Scales (read-only for teacher) ──────────────────────────────────

export async function getTeacherGradingScales(campusId?: string) {
  const qs = campusId ? `?campus_id=${campusId}` : "";
  return apiRequest<GradingScale[]>(`/grading-scales${qs}`);
}

export async function getTeacherGradingScaleGrades(scaleId: string) {
  return apiRequest<GradingScaleGrade[]>(`/grading-scales/${scaleId}/grades`);
}

// ─── Report Card Comments (read-only for teacher) ────────────────────────────

export interface RCCommentCategory {
  id: string;
  title: string;
  color: string | null;
  sort_order: number | null;
  comment_count: number;
}

export interface RCComment {
  id: string;
  title: string;
  category_id: string | null;
  sort_order: number | null;
}

export async function getTeacherRCCategories(campusId?: string) {
  const qs = campusId ? `?campus_id=${campusId}` : "";
  return apiRequest<RCCommentCategory[]>(`/report-cards/categories${qs}`);
}

export async function getTeacherRCComments(categoryId: string) {
  return apiRequest<RCComment[]>(`/report-cards/comments?category_id=${categoryId}`);
}

// ─── Comment Codes (teacher read + own write) ─────────────────────────────────

export async function getTeacherCommentCodes() {
  return apiRequest<TeacherCommentCodeScale[]>("/teachers/setup/comment-codes");
}

export async function createTeacherCommentCodeScale(data: { title: string; comment?: string }) {
  return apiRequest<TeacherCommentCodeScale>("/teachers/setup/comment-codes/scales", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTeacherCommentCodeScale(id: string, data: { title?: string; comment?: string | null }) {
  return apiRequest<TeacherCommentCodeScale>(`/teachers/setup/comment-codes/scales/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTeacherCommentCodeScale(id: string) {
  return apiRequest<void>(`/teachers/setup/comment-codes/scales/${id}`, { method: "DELETE" });
}

export async function createTeacherCommentCode(scaleId: string, data: {
  title: string; short_name?: string; comment?: string; sort_order?: number;
}) {
  return apiRequest<TeacherCommentCode>(`/teachers/setup/comment-codes/scales/${scaleId}/codes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTeacherCommentCode(id: string, data: {
  title?: string; short_name?: string | null; comment?: string | null; sort_order?: number;
}) {
  return apiRequest<TeacherCommentCode>(`/teachers/setup/comment-codes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTeacherCommentCode(id: string) {
  return apiRequest<void>(`/teachers/setup/comment-codes/${id}`, { method: "DELETE" });
}

// ─── Gradebook Config (per-CP overrides for teacher) ─────────────────────────

export async function getTeacherGradebookConfig(coursePeriodId?: string) {
  const qs = coursePeriodId ? `?course_period_id=${coursePeriodId}` : "";
  return apiRequest<Record<string, string>>(`/gradebook/config${qs}`);
}

export async function saveTeacherGradebookConfig(coursePeriodId: string, key: string, value: string) {
  return apiRequest<void>("/gradebook/config", {
    method: "PUT",
    body: JSON.stringify({ course_period_id: coursePeriodId, key, value }),
  });
}
