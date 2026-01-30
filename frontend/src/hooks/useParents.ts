"use client";

import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import * as parentsApi from '@/lib/api/parents';

interface UseParentsOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export function useParents(options: UseParentsOptions = {}) {
  const { user } = useAuth();
  const campusContext = useCampus();
  const { page = 1, limit = 10, search } = options;

  // Create a cache key that includes all parameters INCLUDING campus
  const cacheKey = user 
    ? ['parents', user.id, campusContext?.selectedCampus?.id, page, limit, search] 
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const response = await parentsApi.getParentsWithChildren({
        page,
        limit,
        search: search || undefined,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch parents');
      }

      return {
        parents: response.data || [],
        total: response.pagination?.total || 0,
        totalPages: response.pagination?.totalPages || 0,
        page: response.pagination?.page || 1,
      };
    },
    {
      // Cache successful responses for 10 seconds
      dedupingInterval: 10000,
      // Revalidate on focus (when user comes back to tab)
      revalidateOnFocus: true,
      // Keep previous data while fetching new data (prevents loading flicker)
      keepPreviousData: true,
    }
  );

  // CRUD operations with optimistic updates
  const createParent = async (parentData: parentsApi.CreateParentDTO) => {
    const response = await parentsApi.createParent(parentData);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create parent');
    }

    // Revalidate to fetch updated list
    mutate();
    return response.data;
  };

  const updateParent = async (
    id: string,
    parentData: parentsApi.UpdateParentDTO
  ) => {
    const response = await parentsApi.updateParent(id, parentData);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update parent');
    }

    // Optimistically update the cache
    if (data) {
      mutate({
        ...data,
        parents: data.parents.map((p) =>
          p.id === id ? { ...p, ...response.data } : p
        ),
      }, false);
    }

    return response.data;
  };

  const deleteParent = async (id: string) => {
    const response = await parentsApi.deleteParent(id);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete parent');
    }

    // Optimistically update the cache
    if (data) {
      mutate({
        ...data,
        parents: data.parents.filter((p) => p.id !== id),
        total: data.total - 1,
      }, false);
    }

    return true;
  };

  const linkStudent = async (parentId: string, studentId: string, relationship: string) => {
    const response = await parentsApi.linkParentToStudent(parentId, {
      student_id: studentId,
      relationship,
      is_emergency_contact: false
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to link student');
    }

    // Revalidate to fetch updated parent with children
    mutate();
    return response.data;
  };

  const unlinkStudent = async (parentId: string, studentId: string) => {
    const response = await parentsApi.unlinkParentFromStudent(parentId, studentId);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to unlink student');
    }

    // Revalidate to fetch updated parent with children
    mutate();
    return true;
  };

  return {
    parents: data?.parents || [],
    total: data?.total || 0,
    totalPages: data?.totalPages || 0,
    currentPage: data?.page || page,
    loading: isLoading,
    error: error?.message,
    createParent,
    updateParent,
    deleteParent,
    linkStudent,
    unlinkStudent,
    refresh: mutate,
  };
}
