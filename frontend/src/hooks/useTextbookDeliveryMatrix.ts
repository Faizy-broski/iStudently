"use client";

import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import {
  getDeliveryMatrix,
  syncDelivery,
  bulkSyncDelivery,
  type DeliveryMatrix,
} from "@/lib/api/textbook-deliveries";

const cellKey = (studentId: string, bookId: string) => `${studentId}:${bookId}`;

interface UseTextbookDeliveryMatrixOptions {
  sectionId?: string;
  gradeLevelId?: string;
}

/**
 * Per-cell immediate-write matrix hook — deliberately NOT a "collect edits
 * locally, one Save button" pattern like the gradebook matrix
 * (frontend/src/app/teacher/grades/gradebook/page.tsx). Every toggle fires
 * its own request immediately via toggleCell/toggleAll and optimistically
 * updates just that cell (mutate(data, false), same idiom as
 * useStudents.ts's updateStudent/deleteStudent), reverting only the affected
 * cell(s) on failure. Do not "fix" this back to batch-save.
 */
export function useTextbookDeliveryMatrix({ sectionId, gradeLevelId }: UseTextbookDeliveryMatrixOptions) {
  const { user } = useAuth();
  const campusContext = useCampus();
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());

  const cacheKey = user && (sectionId || gradeLevelId)
    ? ["textbook-delivery-matrix", sectionId, gradeLevelId, campusContext?.selectedCampus?.id]
    : null;

  const { data, error, isLoading, mutate } = useSWR<DeliveryMatrix>(
    cacheKey,
    async () => {
      const response = await getDeliveryMatrix({
        section_id: sectionId,
        grade_level_id: sectionId ? undefined : gradeLevelId,
        campus_id: campusContext?.selectedCampus?.id,
      });
      if (!response.success) throw new Error(response.error || "Failed to fetch delivery matrix");
      return response.data!;
    },
    { revalidateOnFocus: false }
  );

  const isCellPending = (studentId: string, bookId: string) => pendingCells.has(cellKey(studentId, bookId));

  const setPending = (keys: string[], value: boolean) => {
    setPendingCells((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (value ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  /** Single checkbox toggle — one immediate `/sync` call, no page reload. */
  const toggleCell = async (
    studentId: string,
    bookId: string,
    isDelivered: boolean,
    opts?: { override?: boolean; condition?: "new" | "good" | "damaged" }
  ) => {
    if (!data) return;
    const key = cellKey(studentId, bookId);
    const before = data;

    setPending([key], true);
    mutate(
      {
        ...data,
        students: data.students.map((s) =>
          s.id === studentId
            ? {
                ...s,
                deliveries: {
                  ...s.deliveries,
                  [bookId]: { ...(s.deliveries[bookId] ?? blankDelivery(studentId, bookId)), is_delivered: isDelivered },
                },
              }
            : s
        ),
      },
      false
    );

    try {
      const response = await syncDelivery({
        student_id: studentId,
        book_id: bookId,
        is_delivered: isDelivered,
        override: opts?.override,
        condition: opts?.condition,
      });
      if (!response.success || !response.data) {
        mutate(before, false);
        const err: any = new Error(response.error || "Failed to update delivery");
        if ((response as any).code) err.code = (response as any).code;
        throw err;
      }
      const updatedRow = response.data;
      mutate(
        (current) =>
          current && {
            ...current,
            students: current.students.map((s) =>
              s.id === studentId ? { ...s, deliveries: { ...s.deliveries, [bookId]: updatedRow } } : s
            ),
          },
        false
      );
    } finally {
      setPending([key], false);
    }
  };

  /** Row/column "Check All" or barcode scan — one `/bulk-sync` call for every affected cell. */
  const toggleAll = async (
    items: Array<{ studentId: string; bookId: string }>,
    isDelivered: boolean,
    override?: boolean
  ): Promise<{ blockedCount: number }> => {
    if (!data || items.length === 0) return { blockedCount: 0 };
    const keys = items.map((i) => cellKey(i.studentId, i.bookId));
    const before = data;

    setPending(keys, true);
    mutate(
      {
        ...data,
        students: data.students.map((s) => {
          const relevant = items.filter((i) => i.studentId === s.id);
          if (relevant.length === 0) return s;
          const deliveries = { ...s.deliveries };
          for (const r of relevant) {
            deliveries[r.bookId] = { ...(deliveries[r.bookId] ?? blankDelivery(s.id, r.bookId)), is_delivered: isDelivered };
          }
          return { ...s, deliveries };
        }),
      },
      false
    );

    try {
      const response = await bulkSyncDelivery(
        items.map((i) => ({ student_id: i.studentId, book_id: i.bookId, is_delivered: isDelivered })),
        override
      );
      if (!response.success || !response.data) {
        mutate(before, false);
        throw new Error(response.error || "Bulk update failed");
      }

      const { updated, blocked } = response.data;
      const updatedMap = new Map(updated.map((u) => [cellKey(u.student_id, u.book_id), u]));
      const blockedSet = new Set(blocked.map((b) => cellKey(b.student_id, b.book_id)));

      mutate(
        (current) =>
          current && {
            ...current,
            students: current.students.map((s) => {
              const relevant = items.filter((i) => i.studentId === s.id);
              if (relevant.length === 0) return s;
              const deliveries = { ...s.deliveries };
              for (const r of relevant) {
                const key = cellKey(r.studentId, r.bookId);
                if (updatedMap.has(key)) {
                  deliveries[r.bookId] = updatedMap.get(key)!;
                } else if (blockedSet.has(key)) {
                  // Revert just this cell to its pre-toggle value.
                  const original = before.students.find((os) => os.id === s.id);
                  deliveries[r.bookId] = original?.deliveries[r.bookId] ?? null;
                }
              }
              return { ...s, deliveries };
            }),
          },
        false
      );

      return { blockedCount: blocked.length };
    } finally {
      setPending(keys, false);
    }
  };

  return {
    matrix: data ?? null,
    loading: isLoading,
    error: error?.message,
    isCellPending,
    toggleCell,
    toggleAll,
    refresh: mutate,
  };
}

function blankDelivery(studentId: string, bookId: string) {
  return {
    id: "",
    student_id: studentId,
    book_id: bookId,
    is_delivered: false,
    delivered_at: null,
    return_status: "pending" as const,
    condition: null,
  };
}
