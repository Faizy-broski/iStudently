// Entry & exit (school admin): checkpoints + authorized times, records, stats, attendance
// integration, evening leaves, packages, student notes, automatic records and exceptions.
// Same endpoints as frontend/src/lib/api/entry-exit.ts; router: entryExit.routes.ts.
// The web scopes all of these to the main school (profile.school_id).
import type {
  AttendanceIntegrationRecord,
  AutomaticRecord,
  AutomaticRecordException,
  AutoRecordTargetType,
  Checkpoint,
  CheckpointAuthorizedTime,
  CheckpointMode,
  EntryExitRecord,
  EntryExitStats,
  EveningLeave,
  PackageDelivery,
  PersonType,
  RecordType,
  StudentCheckpointNote,
} from '@studently/shared-types'

import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type {
  AttendanceIntegrationRecord,
  AutomaticRecord,
  AutomaticRecordException,
  AutoRecordTargetType,
  Checkpoint,
  CheckpointAuthorizedTime,
  CheckpointMode,
  EntryExitRecord,
  EntryExitStats,
  EveningLeave,
  PackageDelivery,
  PersonType,
  RecordType,
  StudentCheckpointNote,
}

export interface EntryExitRecordFilters {
  school_id: string
  checkpoint_id?: string
  person_type?: string
  record_type?: string
  status?: string
  date_from?: string
  date_to?: string
  person_id?: string
  last_only?: boolean
  limit?: number
}

export interface EveningLeaveInput {
  school_id: string
  student_id: string
  checkpoint_id?: string
  start_date: string
  end_date: string
  days_of_week: number[]
  authorized_return_time: string
  reason?: string
}

export interface AutomaticRecordInput {
  school_id: string
  checkpoint_id: string
  record_type: string
  day_of_week: number
  scheduled_time: string
  target_type?: string
  target_value?: string | null
  created_by?: string
}

export type SchoolException = AutomaticRecordException & { checkpoint_id: string; record_type: string; checkpoint_name?: string }

export function adminEntryExitApi(api: ApiClient) {
  return {
    // Checkpoints
    checkpoints: (schoolId: string) => api.get<Checkpoint[]>(`/entry-exit/checkpoints${qs({ school_id: schoolId })}`),
    checkpoint: (id: string) => api.get<Checkpoint>(`/entry-exit/checkpoints/${id}`),
    createCheckpoint: (body: { school_id: string; name: string; mode?: string; description?: string }) => api.post<Checkpoint>('/entry-exit/checkpoints', body),
    updateCheckpoint: (id: string, body: { name?: string; mode?: string; description?: string; is_active?: boolean }) => api.put<Checkpoint>(`/entry-exit/checkpoints/${id}`, body),
    deleteCheckpoint: (id: string) => api.del(`/entry-exit/checkpoints/${id}`),
    authorizedTimes: (checkpointId: string) => api.get<CheckpointAuthorizedTime[]>(`/entry-exit/checkpoints/${checkpointId}/times`),
    setAuthorizedTimes: (checkpointId: string, times: { day_of_week: number; start_time: string; end_time: string }[]) =>
      api.post<CheckpointAuthorizedTime[]>(`/entry-exit/checkpoints/${checkpointId}/times`, { times }),

    // Records
    createRecord: (body: { school_id: string; checkpoint_id: string; person_id: string; person_type: string; record_type: string; description?: string }) =>
      api.post<EntryExitRecord>('/entry-exit/records', body),
    createBulkRecords: (body: { school_id: string; checkpoint_id: string; person_ids: string[]; person_type: string; record_type: string; description?: string }) =>
      api.post<EntryExitRecord[]>('/entry-exit/records/bulk', body),
    records: (f: EntryExitRecordFilters) => api.get<EntryExitRecord[]>(`/entry-exit/records${qs(f as any)}`),
    stats: (schoolId: string) => api.get<EntryExitStats>(`/entry-exit/stats${qs({ school_id: schoolId })}`),
    deleteRecord: (id: string) => api.del(`/entry-exit/records/${id}`),

    attendanceIntegration: (p: { school_id: string; checkpoint_id: string; date?: string; current_time?: string }) =>
      api.get<AttendanceIntegrationRecord[]>(`/entry-exit/attendance-integration${qs(p as any)}`),

    // Evening leaves
    eveningLeaves: (f: { school_id: string; student_id?: string; is_active?: boolean; date?: string }) => api.get<EveningLeave[]>(`/entry-exit/evening-leaves${qs(f as any)}`),
    createEveningLeave: (body: EveningLeaveInput) => api.post<EveningLeave>('/entry-exit/evening-leaves', body),
    updateEveningLeave: (id: string, body: Partial<Omit<EveningLeaveInput, 'school_id' | 'student_id'>> & { is_active?: boolean }) => api.put<EveningLeave>(`/entry-exit/evening-leaves/${id}`, body),
    deleteEveningLeave: (id: string) => api.del(`/entry-exit/evening-leaves/${id}`),
    eveningLeaveReport: (schoolId: string, date?: string) => api.get<EveningLeave[]>(`/entry-exit/evening-leaves/report${qs({ school_id: schoolId, date })}`),

    // Packages
    packages: (f: { school_id: string; student_id?: string; status?: string; limit?: number }) => api.get<PackageDelivery[]>(`/entry-exit/packages${qs(f as any)}`),
    createPackage: (body: { school_id: string; student_id: string; description?: string; sender?: string }) => api.post<PackageDelivery>('/entry-exit/packages', body),
    pendingPackages: (schoolId: string) => api.get<PackageDelivery[]>(`/entry-exit/packages/pending${qs({ school_id: schoolId })}`),
    pickupPackage: (id: string) => api.patch<PackageDelivery>(`/entry-exit/packages/${id}/pickup`),

    // Student checkpoint notes
    studentNotes: (schoolId: string, studentId: string) => api.get<StudentCheckpointNote | null>(`/entry-exit/students/${studentId}/notes${qs({ school_id: schoolId })}`),
    saveStudentNotes: (schoolId: string, studentId: string, notes: string) => api.put<StudentCheckpointNote>(`/entry-exit/students/${studentId}/notes`, { school_id: schoolId, notes }),

    // Automatic records
    automaticRecords: (schoolId: string) => api.get<AutomaticRecord[]>(`/entry-exit/automatic-records${qs({ school_id: schoolId })}`),
    createAutomaticRecord: (body: AutomaticRecordInput) => api.post<AutomaticRecord>('/entry-exit/automatic-records', body),
    updateAutomaticRecord: (id: string, body: Partial<Omit<AutomaticRecordInput, 'school_id' | 'created_by'>> & { is_active?: boolean }) => api.put<AutomaticRecord>(`/entry-exit/automatic-records/${id}`, body),
    deleteAutomaticRecord: (id: string) => api.del(`/entry-exit/automatic-records/${id}`),
    ruleExceptions: (ruleId: string) => api.get<AutomaticRecordException[]>(`/entry-exit/automatic-records/${ruleId}/exceptions`),
    createRuleException: (body: { school_id: string; automatic_record_id: string; person_id: string; person_type: string; from_date: string; to_date: string; reason?: string; created_by?: string }) =>
      api.post<AutomaticRecordException>(`/entry-exit/automatic-records/${body?.automatic_record_id}/exceptions`, body),
    deleteRuleException: (ruleId: string, exceptionId: string) => api.del(`/entry-exit/automatic-records/${ruleId}/exceptions/${exceptionId}`),

    // School-wide exceptions
    schoolExceptions: (schoolId: string, f: { from_date?: string; to_date?: string; checkpoint_id?: string; record_type?: string } = {}) =>
      api.get<SchoolException[]>(`/entry-exit/exceptions${qs({ school_id: schoolId, ...f })}`),
    bulkCreateExceptions: (body: { school_id: string; person_ids: string[]; person_type: PersonType; checkpoint_id?: string; record_type?: string; from_date: string; to_date: string; reason?: string; created_by?: string }) =>
      api.post<{ created: number }>('/entry-exit/exceptions/bulk', body),
    deleteException: (id: string) => api.del(`/entry-exit/exceptions/${id}`),
  }
}
