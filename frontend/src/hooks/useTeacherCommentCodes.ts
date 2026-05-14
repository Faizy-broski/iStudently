"use client";

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import {
  getTeacherCommentCodes,
  createTeacherCommentCodeScale,
  updateTeacherCommentCodeScale,
  deleteTeacherCommentCodeScale,
  createTeacherCommentCode,
  updateTeacherCommentCode,
  deleteTeacherCommentCode,
  type TeacherCommentCodeScale,
  type TeacherCommentCode,
} from "@/lib/api/teacher-setup";

export type { TeacherCommentCodeScale, TeacherCommentCode };

const CACHE_KEY = "teacher-comment-codes";

export function useTeacherCommentCodes() {
  const { user, profile } = useAuth();
  const staffId = profile?.staff_id;

  const { data, error, isLoading, mutate } = useSWR(
    user && staffId ? [CACHE_KEY, staffId] : null,
    () => getTeacherCommentCodes(),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );

  const scales: TeacherCommentCodeScale[] = data?.data ?? [];

  // ── Scale mutations ──────────────────────────────────────────────────────

  async function addScale(title: string, comment?: string) {
    const res = await createTeacherCommentCodeScale({ title, comment });
    if (!res.success) throw new Error(res.error || "Failed to create scale");
    await mutate();
    return res.data!;
  }

  async function editScale(id: string, updates: { title?: string; comment?: string | null }) {
    const res = await updateTeacherCommentCodeScale(id, updates);
    if (!res.success) throw new Error(res.error || "Failed to update scale");
    await mutate();
    return res.data!;
  }

  async function removeScale(id: string) {
    const res = await deleteTeacherCommentCodeScale(id);
    if (!res.success) throw new Error(res.error || "Failed to delete scale");
    await mutate();
  }

  // ── Code mutations ───────────────────────────────────────────────────────

  async function addCode(scaleId: string, data: {
    title: string; short_name?: string; comment?: string; sort_order?: number;
  }) {
    const res = await createTeacherCommentCode(scaleId, data);
    if (!res.success) throw new Error(res.error || "Failed to create code");
    await mutate();
    return res.data!;
  }

  async function editCode(id: string, data: {
    title?: string; short_name?: string | null; comment?: string | null; sort_order?: number;
  }) {
    const res = await updateTeacherCommentCode(id, data);
    if (!res.success) throw new Error(res.error || "Failed to update code");
    await mutate();
    return res.data!;
  }

  async function removeCode(id: string) {
    const res = await deleteTeacherCommentCode(id);
    if (!res.success) throw new Error(res.error || "Failed to delete code");
    await mutate();
  }

  return {
    scales,
    loading: isLoading,
    error: error?.message as string | undefined,
    addScale,
    editScale,
    removeScale,
    addCode,
    editCode,
    removeCode,
  };
}
