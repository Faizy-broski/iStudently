"use client";

/**
 * useTeacherStudents — Fetches students across all of the teacher's Course Periods.
 *
 * Uses the Course Period architecture:
 *   1. GET /teachers/my-course-periods  → teacher's CPs (filtered by academic year + quarter from context)
 *   2. GET /teachers/my-course-periods/:cpId/students  → students per CP (server-enforces ownership)
 *
 * Students are merged + deduplicated across all CPs, then paginated client-side.
 */

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useAcademic } from "@/context/AcademicContext";
import { getMyCoursePeriods, getCoursePeriodStudents } from "@/lib/api/courses";

interface UseTeacherStudentsOptions {
  page?: number;
  limit?: number;
  search?: string;
  grade_level?: string;
}

export function useTeacherStudents(options: UseTeacherStudentsOptions = {}) {
  const { user, profile } = useAuth();
  const { selectedAcademicYear, selectedQuarter } = useAcademic();
  const { page = 1, limit = 100, search, grade_level } = options;

  const staffId = profile?.staff_id as string | undefined;

  // Step 1: Get teacher's course periods (year filter only — courses may be
  // Full Year or other MP types, never filter by QTR id here)
  const cpCacheKey = staffId && user
    ? ["teacher-my-cps", staffId, selectedAcademicYear]
    : null;

  const { data: coursePeriods, isLoading: loadingCPs } = useSWR(
    cpCacheKey,
    () => getMyCoursePeriods({
      academic_year_id: selectedAcademicYear || undefined,
    }),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  // Step 2: Fetch students for all CPs
  const hasCPs = coursePeriods && coursePeriods.length > 0;

  const studentsCacheKey = hasCPs
    ? ["teacher-cp-students", (coursePeriods || []).map(cp => cp.id).join(",")]
    : null;

  const { data, error, isLoading: loadingStudents, mutate } = useSWR(
    studentsCacheKey,
    async () => {
      const perCpResults = await Promise.all(
        (coursePeriods || []).map(cp => getCoursePeriodStudents(cp.id).catch(() => []))
      );

      // Merge and deduplicate by student ID
      const seen = new Set<string>();
      let allStudents = perCpResults.flat().filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      // Apply search filter
      if (search) {
        const q = search.toLowerCase();
        allStudents = allStudents.filter(s => {
          const name = `${s.profile?.first_name || ''} ${s.profile?.last_name || ''}`.toLowerCase();
          return name.includes(q) || s.student_number?.toLowerCase().includes(q);
        });
      }

      // Apply grade level filter
      if (grade_level && grade_level !== "all") {
        allStudents = allStudents.filter(s => (s as any).grade_level === grade_level);
      }

      const total = allStudents.length;
      const offset = (page - 1) * limit;
      const pageStudents = allStudents.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);

      return { students: pageStudents, total, totalPages, page };
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 15_000,
      keepPreviousData: true,
    }
  );

  return {
    students: data?.students ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    currentPage: data?.page ?? page,
    loading: loadingCPs || loadingStudents,
    isLoading: loadingCPs || loadingStudents,
    error: error?.message as string | undefined,
    hasNoSections: !loadingCPs && (!coursePeriods || coursePeriods.length === 0),
    sectionCount: coursePeriods?.length ?? 0,
    refresh: mutate,
  };
}
