"use client";

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as textbooksApi from "@/lib/api/textbooks";

interface UseTextbooksOptions {
  grade_level_id?: string;
  is_active?: boolean;
}

export function useTextbooks(options: UseTextbooksOptions = {}) {
  const { user } = useAuth();
  const campusContext = useCampus();
  const { grade_level_id, is_active } = options;

  const cacheKey = user
    ? ["textbooks", user.id, campusContext?.selectedCampus?.id, grade_level_id, is_active]
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const response = await textbooksApi.getTextbooks({
        grade_level_id,
        is_active,
        campus_id: campusContext?.selectedCampus?.id,
      });
      if (!response.success) throw new Error(response.error || "Failed to fetch textbooks");
      return response.data || [];
    },
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const createTextbook = async (dto: textbooksApi.CreateTextbookDTO) => {
    const response = await textbooksApi.createTextbook(dto);
    if (!response.success) throw new Error(response.error || "Failed to create textbook");
    mutate();
    return response.data;
  };

  const updateTextbook = async (id: string, dto: textbooksApi.UpdateTextbookDTO) => {
    const response = await textbooksApi.updateTextbook(id, dto);
    if (!response.success) throw new Error(response.error || "Failed to update textbook");
    if (data) {
      mutate(data.map((b) => (b.id === id ? { ...b, ...response.data } : b)), false);
    }
    return response.data;
  };

  const deleteTextbook = async (id: string) => {
    const response = await textbooksApi.deleteTextbook(id);
    if (!response.success) throw new Error(response.error || "Failed to delete textbook");
    if (data) mutate(data.filter((b) => b.id !== id), false);
    return true;
  };

  const restockTextbook = async (id: string, amount: number) => {
    const response = await textbooksApi.restockTextbook(id, amount);
    if (!response.success) throw new Error(response.error || "Failed to restock textbook");
    if (data) mutate(data.map((b) => (b.id === id ? { ...b, ...response.data } : b)), false);
    return response.data;
  };

  return {
    textbooks: data || [],
    loading: isLoading,
    error: error?.message,
    createTextbook,
    updateTextbook,
    deleteTextbook,
    restockTextbook,
    refresh: mutate,
  };
}
