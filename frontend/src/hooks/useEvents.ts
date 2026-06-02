import useSWR from "swr";
import moment from "moment";
import { useCampus } from '@/context/CampusContext';
import { getEventsForRange, getCategoryCounts, type EventCategory } from "@/lib/api/events";

interface UseEventsOptions {
  currentMonth: Date;
  selectedCategory?: EventCategory | 'all';
}

export function useEvents({ currentMonth, selectedCategory }: UseEventsOptions) {
  const campusContext = useCampus()
  const monthKey = moment(currentMonth).format("YYYY-MM");
  const category = selectedCategory === 'all' ? undefined : selectedCategory;
  const campusId = campusContext?.selectedCampus?.id;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    ['events', monthKey, category, campusId],
    async () => {
      const startDate = moment(currentMonth).startOf('month').toISOString();
      const endDate = moment(currentMonth).endOf('month').toISOString();

      const response = await getEventsForRange(startDate, endDate, category, undefined, campusId);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch events");
      }

      return response.data;
    },
    {
      // Keep previous data while loading new data
      keepPreviousData: true,
      // Revalidate on mount only if data is stale
      revalidateIfStale: true,
      // Don't revalidate on focus (already set globally, but explicit here)
      revalidateOnFocus: false,
    }
  );

  return {
    events: data || [],
    isLoading,
    isValidating, // This is true during background revalidation
    error,
    mutate, // For manual cache updates after create/update/delete
  };
}

export function useCategoryCounts(startDate?: string, endDate?: string) {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id;
  
  const { data, error, isLoading, mutate } = useSWR(
    ['event-category-counts', campusId, startDate, endDate],
    async () => {
      const response = await getCategoryCounts(startDate, endDate, campusId);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch category counts");
      }

      return response.data;
    },
    {
      // Category counts don't change often, cache for longer
      dedupingInterval: 30000, // 30 seconds
      revalidateOnFocus: false,
    }
  );

  return {
    categoryCounts: data || {
      academic: 0,
      holiday: 0,
      exam: 0,
      meeting: 0,
      activity: 0,
      reminder: 0
    },
    isLoading,
    error,
    mutate,
  };
}
