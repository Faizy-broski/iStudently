import {
  Checkpoint,
  CheckpointAuthorizedTime,
  EntryExitRecord,
  EntryExitStats,
  EveningLeave,
  PackageDelivery,
  StudentCheckpointNote,
  AutomaticRecord,
  AutomaticRecordException,
  AttendanceIntegrationRecord,
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

export async function deleteRecord(id: string): Promise<void> {
  await apiRequest(`/entry-exit/records/${id}`, { method: "DELETE" });
}

// ========================
// ATTENDANCE INTEGRATION (Premium)
// ========================

export async function getAttendanceIntegration(params: {
  school_id: string;
  checkpoint_id: string;
  date?: string;
  current_time?: string;
}): Promise<AttendanceIntegrationRecord[]> {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.append(k, String(v));
  });
  return apiRequest<AttendanceIntegrationRecord[]>(
    `/entry-exit/attendance-integration?${p.toString()}`,
  );
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
// AUTOMATIC RECORDS (Premium)
// ========================

export async function getAutomaticRecords(
  schoolId: string,
): Promise<AutomaticRecord[]> {
  return apiRequest<AutomaticRecord[]>(
    `/entry-exit/automatic-records?school_id=${schoolId}`,
  );
}

export async function createAutomaticRecord(data: {
  school_id: string;
  checkpoint_id: string;
  record_type: string;
  day_of_week: number;
  scheduled_time: string;
  target_type?: string;
  target_value?: string | null;
  created_by?: string;
}): Promise<AutomaticRecord> {
  return apiRequest<AutomaticRecord>("/entry-exit/automatic-records", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAutomaticRecord(
  id: string,
  data: Partial<{
    checkpoint_id: string;
    record_type: string;
    day_of_week: number;
    scheduled_time: string;
    target_type: string;
    target_value: string | null;
    is_active: boolean;
  }>,
): Promise<AutomaticRecord> {
  return apiRequest<AutomaticRecord>(`/entry-exit/automatic-records/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAutomaticRecord(id: string): Promise<void> {
  await apiRequest(`/entry-exit/automatic-records/${id}`, { method: "DELETE" });
}

export async function getAutomaticRecordExceptions(
  ruleId: string,
): Promise<AutomaticRecordException[]> {
  return apiRequest<AutomaticRecordException[]>(
    `/entry-exit/automatic-records/${ruleId}/exceptions`,
  );
}

export async function createAutomaticRecordException(data: {
  school_id: string;
  automatic_record_id: string;
  person_id: string;
  person_type: string;
  from_date: string;
  to_date: string;
  reason?: string;
  created_by?: string;
}): Promise<AutomaticRecordException> {
  return apiRequest<AutomaticRecordException>(
    `/entry-exit/automatic-records/${data.automatic_record_id}/exceptions`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function deleteAutomaticRecordException(
  ruleId: string,
  exceptionId: string,
): Promise<void> {
  await apiRequest(
    `/entry-exit/automatic-records/${ruleId}/exceptions/${exceptionId}`,
    { method: "DELETE" },
  );
}

// ========================
// SCHOOL-WIDE EXCEPTIONS
// ========================

export async function getSchoolExceptions(
  schoolId: string,
  filters: {
    from_date?: string;
    to_date?: string;
    checkpoint_id?: string;
    record_type?: string;
  } = {},
): Promise<(AutomaticRecordException & { checkpoint_id: string; record_type: string; checkpoint_name?: string })[]> {
  const params = new URLSearchParams({ school_id: schoolId });
  if (filters.from_date) params.append("from_date", filters.from_date);
  if (filters.to_date) params.append("to_date", filters.to_date);
  if (filters.checkpoint_id) params.append("checkpoint_id", filters.checkpoint_id);
  if (filters.record_type) params.append("record_type", filters.record_type);
  return apiRequest(`/entry-exit/exceptions?${params.toString()}`);
}

export async function bulkCreateExceptions(data: {
  school_id: string;
  person_ids: string[];
  person_type: "STUDENT" | "STAFF";
  checkpoint_id?: string;
  record_type?: string;
  from_date: string;
  to_date: string;
  reason?: string;
  created_by?: string;
}): Promise<{ created: number }> {
  return apiRequest("/entry-exit/exceptions/bulk", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteExceptionById(id: string): Promise<void> {
  await apiRequest(`/entry-exit/exceptions/${id}`, { method: "DELETE" });
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

