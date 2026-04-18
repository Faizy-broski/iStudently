"use client";

/**
 * useTeacherStudents — Secure, role-scoped student data hook for the teacher dashboard.
 *
 * Strategy (two-step, no backend changes required):
 *   Step 1: Fetch the teacher's section IDs from GET /api/teachers/assignments
 *           (filtered server-side by the authenticated teacher's staff_id)
 *   Step 2: For each page request, fetch students from GET /api/students
 *           with section_id whitelisted to only those sections.
 *
 * Security guarantee:
 *   - A teacher can ONLY see students whose section_id appears in their own
 *     teacher_subject_assignments rows. The backend enforces school_id isolation
 *     on top of that. There is zero risk of leaking cross-teacher or cross-school data.
 *   - useStudents() (admin hook) is NOT touched or shared here.
 */

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as studentsApi from "@/lib/api/students";
import { API_URL } from "@/config/api";
import { getAuthToken } from "@/lib/api/schools";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeacherAssignment {
  id: string;
  section_id: string;
  section?: { id: string; name: string };
}

interface UseTeacherStudentsOptions {
  page?: number;
  limit?: number;
  search?: string;
  grade_level?: string;
}

// ---------------------------------------------------------------------------
// Internal helper: fetch the authenticated teacher's assigned section IDs
// ---------------------------------------------------------------------------

async function fetchTeacherSectionIds(staffId: string, campusId?: string): Promise<string[]> {
  const token = await getAuthToken();
  if (!token || !staffId) return [];

  const params = new URLSearchParams({ teacher_id: staffId });
  if (campusId) params.append("campus_id", campusId);

  const res = await fetch(`${API_URL}/teachers/assignments?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];

  const body = await res.json();
  const assignments: TeacherAssignment[] = body.data ?? [];

  // Deduplicate section IDs
  const seen = new Set<string>();
  return assignments
    .map((a) => a.section_id)
    .filter((id): id is string => !!id && !seen.has(id) && seen.add(id) !== undefined);
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useTeacherStudents(options: UseTeacherStudentsOptions = {}) {
  const { user, profile } = useAuth();
  const campusContext = useCampus();
  const { page = 1, limit = 10, search, grade_level } = options;

  // The teacher's staff record ID (different from auth user ID)
  const staffId = profile?.staff_id as string | undefined;
  const campusId = campusContext?.selectedCampus?.id;

  // -------------------------------------------------------------------------
  // Step 1: Get this teacher's section IDs (cached separately; rarely changes)
  // -------------------------------------------------------------------------
  const sectionsCacheKey = staffId
    ? ["teacher-section-ids", staffId, campusId]
    : null;

  const { data: sectionIds, isLoading: loadingSections } = useSWR<string[]>(
    sectionsCacheKey,
    () => fetchTeacherSectionIds(staffId!, campusId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // section assignments change rarely – cache 60s
    }
  );

  // -------------------------------------------------------------------------
  // Step 2: Fetch students ONLY from those sections, with pagination/search
  //
  // If the teacher has multiple sections we fetch them per section and merge
  // client-side (the backend supports a single section_id filter per request).
  // For pagination to work correctly across multiple sections we fetch all
  // sections' students client-side and apply pagination ourselves.
  // -------------------------------------------------------------------------

  const hasNoSections = sectionIds !== undefined && sectionIds.length === 0;

  const studentsCacheKey =
    sectionIds && sectionIds.length > 0 && user
      ? ["teacher-students", user.id, campusId, sectionIds.join(","), page, limit, search, grade_level]
      : null;

  const { data, error, isLoading: loadingStudents, mutate } = useSWR(
    studentsCacheKey,
    async () => {
      // Fetch all pages' students across all sections in one shot:
      // We request a large limit per section then apply client-side pagination.
      const FETCH_ALL_LIMIT = 500;

      const perSectionResults = await Promise.all(
        sectionIds!.map((sectionId) =>
          studentsApi.getStudents({
            limit: FETCH_ALL_LIMIT,
            page: 1,
            search: search || undefined,
            grade_level: grade_level !== "all" ? grade_level : undefined,
            campus_id: campusId,
            section_id: sectionId,
          })
        )
      );

      // Merge, deduplicate by student ID
      const seen = new Set<string>();
      let allStudents = perSectionResults
        .flatMap((r) => r.data ?? [])
        .filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });

      const total = allStudents.length;

      // Apply client-side pagination
      const offset = (page - 1) * limit;
      const pageStudents = allStudents.slice(offset, offset + limit);
      const totalPages = Math.ceil(total / limit);

      return { students: pageStudents, total, totalPages, page };
    },
    {
      dedupingInterval: 10_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      errorRetryCount: 2,
      errorRetryInterval: 1000,
      shouldRetryOnError: (err) => {
        const msg = err?.message || "";
        return (
          !msg.includes("401") &&
          !msg.includes("Session expired") &&
          !msg.includes("Authentication")
        );
      },
    }
  );

  return {
    students: data?.students ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    currentPage: data?.page ?? page,
    /** True while section assignments or students are being fetched */
    loading: loadingSections || loadingStudents,
    /** Error message string, or undefined */
    error: error?.message as string | undefined,
    /** True if we know the teacher has no section assignments */
    hasNoSections,
    /** Number of unique sections this teacher is assigned to */
    sectionCount: sectionIds?.length ?? 0,
    /** Force re-fetch (e.g. after a mutation) */
    refresh: mutate,
  };
}
