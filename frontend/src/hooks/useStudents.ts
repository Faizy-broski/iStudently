"use client";

import useSWR from 'swr';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import * as studentsApi from '@/lib/api/students';

interface UseStudentsOptions {
  page?: number;
  limit?: number;
  search?: string;
  grade_level?: string;
}

export function useStudents(options: UseStudentsOptions = {}) {
  const { user } = useAuth();
  const campusContext = useCampus();
  const { page = 1, limit = 10, search, grade_level } = options;

  // Create a cache key that includes all parameters INCLUDING campus
  const cacheKey = user 
    ? ['students', user.id, campusContext?.selectedCampus?.id, page, limit, search, grade_level] 
    : null;

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const response = await studentsApi.getStudents({
        page,
        limit,
        search: search || undefined,
        grade_level: grade_level !== 'all' ? grade_level : undefined,
        campus_id: campusContext?.selectedCampus?.id,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch students');
      }

      return {
        students: response.data || [],
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
  const createStudent = async (studentData: studentsApi.CreateStudentDTO) => {
    const response = await studentsApi.createStudent(studentData);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create student');
    }

    // Revalidate to fetch updated list
    mutate();
    return response.data;
  };

  const updateStudent = async (
    id: string,
    studentData: studentsApi.UpdateStudentDTO
  ) => {
    const response = await studentsApi.updateStudent(
      id, 
      studentData, 
      campusContext?.selectedCampus?.id
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update student');
    }

    // Optimistically update the cache
    if (data) {
      mutate({
        ...data,
        students: data.students.map((s) =>
          s.id === id ? { ...s, ...response.data } : s
        ),
      }, false);
    }

    return response.data;
  };

  const deleteStudent = async (id: string) => {
    const response = await studentsApi.deleteStudent(id);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete student');
    }

    // Optimistically update the cache
    if (data) {
      mutate({
        ...data,
        students: data.students.filter((s) => s.id !== id),
        total: data.total - 1,
      }, false);
    }

    return true;
  };

  return {
    students: data?.students || [],
    total: data?.total || 0,
    totalPages: data?.totalPages || 0,
    currentPage: data?.page || page,
    loading: isLoading,
    error: error?.message,
    createStudent,
    updateStudent,
    deleteStudent,
    refresh: mutate,
  };
}
