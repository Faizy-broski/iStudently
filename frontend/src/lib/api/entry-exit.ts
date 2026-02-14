import {
  Checkpoint,
  CheckpointAuthorizedTime,
  EntryExitRecord,
  EntryExitStats,
  EveningLeave,
  PackageDelivery,
  StudentCheckpointNote,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function apiRequest<T = any>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${res.status}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

async function apiRequestToken<T = any>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const { createClient } = await import("@/lib/supabase/client");
  const token = (await createClient().auth.getSession()).data.session
    ?.access_token;
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    ...options,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${res.status}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

// ========================
// CHECKPOINTS
// ========================

export async function getCheckpoints(schoolId: string): Promise<Checkpoint[]> {
  return apiRequest<Checkpoint[]>(
    `/entry-exit/checkpoints?school_id=${schoolId}`,
  );
}

export async function getCheckpointById(id: string): Promise<Checkpoint> {
  return apiRequest<Checkpoint>(`/entry-exit/checkpoints/${id}`);
}

export async function createCheckpoint(data: {
  school_id: string;
  name: string;
  mode?: string;
  description?: string;
}): Promise<Checkpoint> {
  return apiRequest<Checkpoint>("/entry-exit/checkpoints", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCheckpoint(
  id: string,
  data: {
    name?: string;
    mode?: string;
    description?: string;
    is_active?: boolean;
  },
): Promise<Checkpoint> {
  return apiRequest<Checkpoint>(`/entry-exit/checkpoints/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCheckpoint(id: string): Promise<void> {
  await apiRequest(`/entry-exit/checkpoints/${id}`, { method: "DELETE" });
}

export async function getAuthorizedTimes(
  checkpointId: string,
): Promise<CheckpointAuthorizedTime[]> {
  return apiRequest<CheckpointAuthorizedTime[]>(
    `/entry-exit/checkpoints/${checkpointId}/times`,
  );
}

export async function setAuthorizedTimes(
  checkpointId: string,
  times: { day_of_week: number; start_time: string; end_time: string }[],
): Promise<CheckpointAuthorizedTime[]> {
  return apiRequest<CheckpointAuthorizedTime[]>(
    `/entry-exit/checkpoints/${checkpointId}/times`,
    {
      method: "POST",
      body: JSON.stringify({ times }),
    },
  );
}

// ========================
// RECORDS
// ========================

export async function createRecord(data: {
  school_id: string;
  checkpoint_id: string;
  person_id: string;
  person_type: string;
  record_type: string;
  description?: string;
}): Promise<EntryExitRecord> {
  return apiRequest<EntryExitRecord>("/entry-exit/records", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createBulkRecords(data: {
  school_id: string;
  checkpoint_id: string;
  person_ids: string[];
  person_type: string;
  record_type: string;
  description?: string;
}): Promise<EntryExitRecord[]> {
  return apiRequest<EntryExitRecord[]>("/entry-exit/records/bulk", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getRecords(filters: {
  school_id: string;
  checkpoint_id?: string;
  person_type?: string;
  record_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  person_id?: string;
  last_only?: boolean;
  limit?: number;
}): Promise<EntryExitRecord[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      params.append(key, String(value));
    }
  });
  return apiRequest<EntryExitRecord[]>(
    `/entry-exit/records?${params.toString()}`,
  );
}

export async function getStats(schoolId: string): Promise<EntryExitStats> {
  return apiRequest<EntryExitStats>(`/entry-exit/stats?school_id=${schoolId}`);
}

// ========================
// EVENING LEAVES
// ========================

export async function getEveningLeaves(filters: {
  school_id: string;
  student_id?: string;
  is_active?: boolean;
  date?: string;
}): Promise<EveningLeave[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      params.append(key, String(value));
    }
  });
  return apiRequest<EveningLeave[]>(
    `/entry-exit/evening-leaves?${params.toString()}`,
  );
}

export async function createEveningLeave(data: {
  school_id: string;
  student_id: string;
  checkpoint_id?: string;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  authorized_return_time: string;
  reason?: string;
}): Promise<EveningLeave> {
  return apiRequest<EveningLeave>("/entry-exit/evening-leaves", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEveningLeave(
  id: string,
  data: {
    checkpoint_id?: string;
    start_date?: string;
    end_date?: string;
    days_of_week?: number[];
    authorized_return_time?: string;
    reason?: string;
    is_active?: boolean;
  },
): Promise<EveningLeave> {
  return apiRequest<EveningLeave>(`/entry-exit/evening-leaves/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteEveningLeave(id: string): Promise<void> {
  await apiRequest(`/entry-exit/evening-leaves/${id}`, { method: "DELETE" });
}

export async function getEveningLeaveReport(
  schoolId: string,
  date?: string,
): Promise<any[]> {
  const params = new URLSearchParams({ school_id: schoolId });
  if (date) params.append("date", date);
  return apiRequest(`/entry-exit/evening-leaves/report?${params.toString()}`);
}

// ========================
// PACKAGES
// ========================

export async function getPackages(filters: {
  school_id: string;
  student_id?: string;
  status?: string;
  limit?: number;
}): Promise<PackageDelivery[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      params.append(key, String(value));
    }
  });
  return apiRequest<PackageDelivery[]>(
    `/entry-exit/packages?${params.toString()}`,
  );
}

export async function createPackage(data: {
  school_id: string;
  student_id: string;
  description?: string;
  sender?: string;
}): Promise<PackageDelivery> {
  return apiRequest<PackageDelivery>("/entry-exit/packages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPendingPackages(
  schoolId: string,
): Promise<PackageDelivery[]> {
  return apiRequest<PackageDelivery[]>(
    `/entry-exit/packages/pending?school_id=${schoolId}`,
  );
}

export async function pickupPackage(id: string): Promise<PackageDelivery> {
  return apiRequest<PackageDelivery>(`/entry-exit/packages/${id}/pickup`, {
    method: "PATCH",
  });
}

// ========================
// STUDENT NOTES
// ========================

export async function getStudentNotes(
  schoolId: string,
  studentId: string,
): Promise<StudentCheckpointNote | null> {
  return apiRequest<StudentCheckpointNote | null>(
    `/entry-exit/students/${studentId}/notes?school_id=${schoolId}`,
  );
}

export async function upsertStudentNotes(
  schoolId: string,
  studentId: string,
  notes: string,
): Promise<StudentCheckpointNote> {
  return apiRequest<StudentCheckpointNote>(
    `/entry-exit/students/${studentId}/notes`,
    {
      method: "PUT",
      body: JSON.stringify({ school_id: schoolId, notes }),
    },
  );
}

// ========================
// STUDENTS (for searchable select)
// ========================

export async function searchStudents(
  schoolId: string,
  query?: string,
): Promise<any[]> {
  const params = new URLSearchParams({ school_id: schoolId });
  if (query) params.append("search", query);
  return apiRequestToken(`/students?${params.toString()}`);
}
