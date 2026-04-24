"use client";

import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { getTeacherGradebookConfig, saveTeacherGradebookConfig } from "@/lib/api/teacher-setup";

const SORT_OPTIONS = ["due_date", "assigned_date", "title", "points"] as const;
type SortOption = typeof SORT_OPTIONS[number];

export interface TeacherCPConfig {
  assignment_sorting: SortOption;
  weight_assignment_types: boolean;
  weight_assignments: boolean;
  default_assigned_date: boolean;
  default_due_date: boolean;
  anomalous_max: number;
  latency: number | null;
}

function parseConfig(raw: Record<string, string>): TeacherCPConfig {
  return {
    assignment_sorting: (SORT_OPTIONS.includes(raw.assignment_sorting as SortOption)
      ? raw.assignment_sorting
      : "due_date") as SortOption,
    weight_assignment_types: raw.weight_assignment_types !== "false",
    weight_assignments: raw.weight_assignments !== "false",
    default_assigned_date: raw.default_assigned_date !== "false",
    default_due_date: raw.default_due_date !== "false",
    anomalous_max: parseInt(raw.anomalous_max ?? "100", 10) || 100,
    latency: raw.latency != null && raw.latency !== "" ? parseInt(raw.latency, 10) : null,
  };
}

export function useTeacherGradebookConfig(coursePeriodId?: string) {
  const { user } = useAuth();

  const cacheKey = user ? ["teacher-gb-config", coursePeriodId ?? "global"] : null;

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    () => getTeacherGradebookConfig(coursePeriodId),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const raw: Record<string, string> = data?.data ?? {};
  const config = parseConfig(raw);

  async function saveKey(key: string, value: string) {
    if (!coursePeriodId) throw new Error("A course period must be selected to save config");
    const res = await saveTeacherGradebookConfig(coursePeriodId, key, value);
    if (!res.success) throw new Error(res.error || "Failed to save config");
    await mutate();
  }

  async function saveConfig(updates: Partial<TeacherCPConfig>) {
    if (!coursePeriodId) throw new Error("A course period must be selected to save config");
    const entries = Object.entries(updates) as [string, unknown][];
    for (const [key, val] of entries) {
      await saveKey(key, String(val));
    }
  }

  return {
    config,
    loading: isLoading,
    error: error?.message as string | undefined,
    saveConfig,
  };
}
