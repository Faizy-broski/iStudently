"use client";

import useSWR from "swr";
import { useCampus } from "@/context/CampusContext";
import { getTeacherGradingScales, getTeacherGradingScaleGrades } from "@/lib/api/teacher-setup";

export function useGradingScales() {
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;

  const { data, error, isLoading } = useSWR(
    ["grading-scales-teacher", campusId],
    () => getTeacherGradingScales(campusId),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    scales: data?.data ?? [],
    loading: isLoading,
    error: error?.message as string | undefined,
  };
}

export function useGradingScaleGrades(scaleId: string | null) {
  const { data, error, isLoading } = useSWR(
    scaleId ? ["grading-scale-grades", scaleId] : null,
    () => getTeacherGradingScaleGrades(scaleId!),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    grades: data?.data ?? [],
    loading: isLoading,
    error: error?.message as string | undefined,
  };
}
