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

// ─── STATS ────────────────────────────────────────────────
export function getHostelStats(schoolId: string) {
  return apiRequest(`/hostel/stats?school_id=${schoolId}`);
}

// ─── BUILDINGS ────────────────────────────────────────────
export function getBuildings(schoolId: string) {
  return apiRequest(`/hostel/buildings?school_id=${schoolId}`);
}

export function createBuilding(data: any) {
  return apiRequest("/hostel/buildings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateBuilding(id: string, schoolId: string, data: any) {
  return apiRequest(`/hostel/buildings/${id}?school_id=${schoolId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteBuilding(id: string, schoolId: string) {
  return apiRequest(`/hostel/buildings/${id}?school_id=${schoolId}`, {
    method: "DELETE",
  });
}

// ─── ROOMS ────────────────────────────────────────────────
export function getRooms(schoolId: string, buildingId?: string) {
  let url = `/hostel/rooms?school_id=${schoolId}`;
  if (buildingId) url += `&building_id=${buildingId}`;
  return apiRequest(url);
}

export function createRoom(data: any) {
  return apiRequest("/hostel/rooms", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRoom(id: string, schoolId: string, data: any) {
  return apiRequest(`/hostel/rooms/${id}?school_id=${schoolId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteRoom(id: string, schoolId: string) {
  return apiRequest(`/hostel/rooms/${id}?school_id=${schoolId}`, {
    method: "DELETE",
  });
}

// ─── ASSIGNMENTS ──────────────────────────────────────────
export function getAssignments(
  schoolId: string,
  filters?: { building_id?: string; room_id?: string; active_only?: boolean },
) {
  let url = `/hostel/assignments?school_id=${schoolId}`;
  if (filters?.building_id) url += `&building_id=${filters.building_id}`;
  if (filters?.room_id) url += `&room_id=${filters.room_id}`;
  if (filters?.active_only === false) url += `&active_only=false`;
  return apiRequest(url);
}

export function assignStudent(data: any) {
  return apiRequest("/hostel/assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function releaseStudent(assignmentId: string) {
  return apiRequest(`/hostel/assignments/${assignmentId}`, {
    method: "DELETE",
  });
}

export function getStudentRoom(studentId: string) {
  return apiRequest(`/hostel/assignments/student/${studentId}`);
}

// ─── VISITS ───────────────────────────────────────────────
export function getVisits(
  schoolId: string,
  filters?: {
    student_id?: string;
    room_id?: string;
    date_from?: string;
    date_to?: string;
    active_only?: boolean;
  },
) {
  let url = `/hostel/visits?school_id=${schoolId}`;
  if (filters?.student_id) url += `&student_id=${filters.student_id}`;
  if (filters?.room_id) url += `&room_id=${filters.room_id}`;
  if (filters?.date_from) url += `&date_from=${filters.date_from}`;
  if (filters?.date_to) url += `&date_to=${filters.date_to}`;
  if (filters?.active_only) url += `&active_only=true`;
  return apiRequest(url);
}

export function createVisit(data: any) {
  return apiRequest("/hostel/visits", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function checkOutVisit(visitId: string) {
  return apiRequest(`/hostel/visits/${visitId}/checkout`, {
    method: "PATCH",
  });
}

// ─── RENTAL FEES ──────────────────────────────────────────
export function getRentalFees(
  schoolId: string,
  filters?: {
    student_id?: string;
    status?: string;
    period_start?: string;
    period_end?: string;
  },
) {
  let url = `/hostel/fees?school_id=${schoolId}`;
  if (filters?.student_id) url += `&student_id=${filters.student_id}`;
  if (filters?.status) url += `&status=${filters.status}`;
  if (filters?.period_start) url += `&period_start=${filters.period_start}`;
  if (filters?.period_end) url += `&period_end=${filters.period_end}`;
  return apiRequest(url);
}

export function generateRentalFees(data: any) {
  return apiRequest("/hostel/fees/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function recordFeePayment(data: {
  fee_id: string;
  amount: number;
  notes?: string;
}) {
  return apiRequest("/hostel/fees/payment", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── FILES ────────────────────────────────────────────────
export function getFiles(entityType: string, entityId: string) {
  return apiRequest(
    `/hostel/files?entity_type=${entityType}&entity_id=${entityId}`,
  );
}

export function addFile(data: any) {
  return apiRequest("/hostel/files", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteFile(id: string, schoolId: string) {
  return apiRequest(`/hostel/files/${id}?school_id=${schoolId}`, {
    method: "DELETE",
  });
}

// ─── SEARCH ───────────────────────────────────────────────
export function searchStudentsByBuilding(schoolId: string, buildingId: string) {
  return apiRequest(
    `/hostel/search/students?school_id=${schoolId}&building_id=${buildingId}`,
  );
}

export function searchStudentsByRoom(schoolId: string, roomId: string) {
  return apiRequest(
    `/hostel/search/students?school_id=${schoolId}&room_id=${roomId}`,
  );
}

// ─── STUDENT SEARCH (reuse from entry-exit pattern) ──────
// export async function searchStudents(schoolId: string, query: string) {
//   const { createClient } = await import("@/lib/supabase/client");
//   const token = (await createClient().auth.getSession()).data.session
//     ?.access_token;
//   return apiRequest(
//     `/students/search?school_id=${schoolId}&q=${encodeURIComponent(query)}`,
//     {
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//     },
//   );
// }
export async function searchStudents(
  schoolId: string,
  query?: string,
): Promise<any[]> {
  const params = new URLSearchParams({ school_id: schoolId });
  if (query) params.append("search", query);
  return apiRequestToken(`/students?${params.toString()}`);
}
