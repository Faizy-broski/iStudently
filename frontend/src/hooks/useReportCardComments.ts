"use client";

import useSWR from "swr";
import { useCampus } from "@/context/CampusContext";
import { getTeacherRCCategories, getTeacherRCComments } from "@/lib/api/teacher-setup";

export function useReportCardCommentCategories() {
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const { data, error, isLoading } = useSWR(
    ["rc-comment-categories-teacher", campusId],
    () => getTeacherRCCategories(campusId),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    categories: data?.data ?? [],
    loading: isLoading,
    error: error?.message as string | undefined,
  };
}

export function useReportCardComments(categoryId: string | null) {
  const { data, error, isLoading } = useSWR(
    categoryId ? ["rc-comments-teacher", categoryId] : null,
    () => getTeacherRCComments(categoryId!),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    comments: data?.data ?? [],
    loading: isLoading,
    error: error?.message as string | undefined,
  };
}
