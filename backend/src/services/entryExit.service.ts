import { supabase } from "../config/supabase";
import {
  CreateCheckpointDTO,
  UpdateCheckpointDTO,
  CreateEntryExitDTO,
  EntryStatus,
} from "../types/index";

type RecordType = "ENTRY" | "EXIT";

export class EntryExitService {
  // ========================
  // CHECKPOINTS
  // ========================

  static async getCheckpoints(schoolId: string) {
    const { data, error } = await supabase
      .from("checkpoints")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");

    if (error) throw error;
    return data;
  }

  static async getCheckpointById(id: string) {
    const { data, error } = await supabase
      .from("checkpoints")
      .select("*, checkpoint_authorized_times(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  }

  static async createCheckpoint(dto: CreateCheckpointDTO) {
    const { data, error } = await supabase
      .from("checkpoints")
      .insert({
        school_id: dto.school_id,
        name: dto.name,
        mode: dto.mode || "both",
        description: dto.description || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateCheckpoint(id: string, dto: UpdateCheckpointDTO) {
    const updates: any = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.mode !== undefined) updates.mode = dto.mode;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;

    const { data, error } = await supabase
      .from("checkpoints")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteCheckpoint(id: string) {
    const { error } = await supabase.from("checkpoints").delete().eq("id", id);

    if (error) throw error;
    return { success: true };
  }

  // ========================
  // AUTHORIZED TIMES
  // ========================

  static async getAuthorizedTimes(checkpointId: string) {
    const { data, error } = await supabase
      .from("checkpoint_authorized_times")
      .select("*")
      .eq("checkpoint_id", checkpointId)
      .order("day_of_week")
      .order("start_time");

    if (error) throw error;
    return data;
  }

  static async setAuthorizedTimes(
    checkpointId: string,
    times: { day_of_week: number; start_time: string; end_time: string }[],
  ) {
    // Delete existing times
    const { error: deleteError } = await supabase
      .from("checkpoint_authorized_times")
      .delete()
      .eq("checkpoint_id", checkpointId);

    if (deleteError) throw deleteError;

    if (times.length === 0) return [];

    // Insert new times
    const rows = times.map((t) => ({
      checkpoint_id: checkpointId,
      day_of_week: t.day_of_week,
      start_time: t.start_time,
      end_time: t.end_time,
    }));

    const { data, error } = await supabase
      .from("checkpoint_authorized_times")
      .insert(rows)
      .select();

    if (error) throw error;
    return data;
  }

  // ========================
  // RECORDS
  // ========================

  static async resolveStatus(
    checkpointId: string,
    recordType: string,
  ): Promise<EntryStatus> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun

    const { data: times } = await supabase
      .from("checkpoint_authorized_times")
      .select("*")
      .eq("checkpoint_id", checkpointId)
      .eq("day_of_week", dayOfWeek);

    if (!times || times.length === 0) return "unauthorized";

    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

    for (const t of times) {
      if (currentTime >= t.start_time && currentTime <= t.end_time) {
        return "authorized";
      }
    }

    return "late";
  }

  /**
   * Resolve which record type to apply next for a person at a checkpoint.
   * Queries the last record and returns the opposite direction (toggle).
   * Falls back to 'ENTRY' if no prior record exists.
   */
  static async resolveRecordType(
    personId: string,
    personType: string,
    checkpointId: string,
  ): Promise<RecordType> {
    const { data } = await supabase
      .from("entry_exit_records")
      .select("record_type")
      .eq("person_id", personId)
      .eq("person_type", personType)
      .eq("checkpoint_id", checkpointId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return "ENTRY";
    return data.record_type === "ENTRY" ? "EXIT" : "ENTRY";
  }

  static async createRecord(dto: CreateEntryExitDTO & { record_type?: RecordType }) {
    // Auto-toggle record_type if not provided
    const record_type: RecordType =
      (dto.record_type as RecordType) ||
      (await this.resolveRecordType(
        dto.person_id,
        dto.person_type,
        dto.checkpoint_id,
      ));

    // Soft double-entry detection: warn if last record matches the incoming type
    const { data: lastRecord } = await supabase
      .from("entry_exit_records")
      .select("record_type")
      .eq("person_id", dto.person_id)
      .eq("person_type", dto.person_type)
      .eq("checkpoint_id", dto.checkpoint_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const duplicateDirection =
      lastRecord && lastRecord.record_type === record_type;

    const status = await this.resolveStatus(dto.checkpoint_id, record_type);

    const { data, error } = await supabase
      .from("entry_exit_records")
      .insert({
        school_id: dto.school_id,
        checkpoint_id: dto.checkpoint_id,
        person_id: dto.person_id,
        person_type: dto.person_type,
        record_type,
        status,
        description: dto.description || null,
      })
      .select(
        `
        *,
        checkpoints ( name )
      `,
      )
      .single();

    if (error) throw error;

    // Enrich with person name
    const enriched = await this.enrichRecordsWithNames([data]);
    const result = enriched[0] as any;
    if (duplicateDirection) {
      result.warning = "DUPLICATE_DIRECTION";
    }
    return result;
  }

  static async deleteRecord(id: string) {
    const { error } = await supabase
      .from("entry_exit_records")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { success: true };
  }

  /**
   * Delete records older than N days for a school.
   * Called by the nightly cron job when configured.
   */
  static async deleteOldRecords(schoolId: string, daysOlderThan: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOlderThan);
    const cutoffStr = cutoff.toISOString();

    const { error } = await supabase
      .from("entry_exit_records")
      .delete()
      .eq("school_id", schoolId)
      .lt("recorded_at", cutoffStr);

    if (error) throw error;
    return { success: true, cutoff: cutoffStr };
  }

  static async createBulkRecords(dto: {
    school_id: string;
    checkpoint_id: string;
    person_ids: string[];
    person_type: string;
    record_type: string;
    description?: string;
  }) {
    const status = await this.resolveStatus(dto.checkpoint_id, dto.record_type);

    const rows = dto.person_ids.map((pid) => ({
      school_id: dto.school_id,
      checkpoint_id: dto.checkpoint_id,
      person_id: pid,
      person_type: dto.person_type,
      record_type: dto.record_type,
      status,
      description: dto.description || null,
    }));

    const { data, error } = await supabase
      .from("entry_exit_records")
      .insert(rows)
      .select();

    if (error) throw error;
    return data;
  }

  static async getRecords(filters: {
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
  }) {
    let query = supabase
      .from("entry_exit_records")
      .select(
        `
        *,
        checkpoints ( name )
      `,
      )
      .eq("school_id", filters.school_id);

    if (filters.checkpoint_id)
      query = query.eq("checkpoint_id", filters.checkpoint_id);
    if (filters.person_type)
      query = query.eq("person_type", filters.person_type);
    if (filters.record_type)
      query = query.eq("record_type", filters.record_type);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.person_id) query = query.eq("person_id", filters.person_id);
    if (filters.date_from) query = query.gte("recorded_at", filters.date_from);
    if (filters.date_to)
      query = query.lte("recorded_at", filters.date_to + "T23:59:59");

    query = query.order("recorded_at", { ascending: false });

    if (filters.limit) query = query.limit(filters.limit);
    else query = query.limit(200);

    const { data, error } = await query;
    if (error) throw error;

    // Enrich records with person names from profiles
    return this.enrichRecordsWithNames(data || []);
  }

  /**
   * Enrich entry/exit records with person names.
   * person_id stores students.id (when person_type=STUDENT) or staff.id (when person_type=STAFF).
   * We resolve names via: students → profiles and staff → profiles.
   */
  private static async enrichRecordsWithNames(records: any[]) {
    if (records.length === 0) return [];

    // Separate person IDs by type
    const studentIds = [
      ...new Set(
        records
          .filter((r) => r.person_type === "STUDENT")
          .map((r) => r.person_id),
      ),
    ];
    const staffIds = [
      ...new Set(
        records
          .filter((r) => r.person_type !== "STUDENT")
          .map((r) => r.person_id),
      ),
    ];

    // Build name lookup map: person_id → { first_name, last_name }
    const nameMap = new Map<
      string,
      { first_name: string; last_name: string }
    >();

    // Batch-fetch student names: students.id → students.profile_id → profiles
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select(
          `
          id,
          profiles ( first_name, last_name )
        `,
        )
        .in("id", studentIds);

      (students || []).forEach((s: any) => {
        if (s.profiles) {
          nameMap.set(s.id, {
            first_name: s.profiles.first_name,
            last_name: s.profiles.last_name,
          });
        }
      });
    }

    // Batch-fetch staff names: staff.id → staff.profile_id → profiles
    if (staffIds.length > 0) {
      const { data: staffMembers } = await supabase
        .from("staff")
        .select(
          `
          id,
          profile:profiles!staff_profile_id_fkey ( first_name, last_name )
        `,
        )
        .in("id", staffIds);

      (staffMembers || []).forEach((s: any) => {
        if (s.profile) {
          nameMap.set(s.id, {
            first_name: s.profile.first_name,
            last_name: s.profile.last_name,
          });
        }
      });
    }

    // Flatten checkpoint name and add person_name
    return records.map((r) => {
      const person = nameMap.get(r.person_id);
      return {
        ...r,
        checkpoint_name: r.checkpoints?.name || null,
        person_name: person
          ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
          : null,
      };
    });
  }

  static async getStats(schoolId: string) {
    const today = new Date().toISOString().split("T")[0];

    // Entries today
    const { count: entries } = await supabase
      .from("entry_exit_records")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("record_type", "ENTRY")
      .gte("recorded_at", today);

    // Exits today
    const { count: exits } = await supabase
      .from("entry_exit_records")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("record_type", "EXIT")
      .gte("recorded_at", today);

    // Pending packages
    const { count: packages } = await supabase
      .from("package_deliveries")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "pending");

    return {
      entries: entries || 0,
      exits: exits || 0,
      inside: Math.max(0, (entries || 0) - (exits || 0)),
      packages: packages || 0,
    };
  }

  // ========================
  // STUDENT NOTES
  // ========================

  static async getStudentNotes(schoolId: string, studentId: string) {
    const { data, error } = await supabase
      .from("student_checkpoint_notes")
      .select("*")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async upsertStudentNotes(
    schoolId: string,
    studentId: string,
    notes: string,
    createdBy?: string,
  ) {
    const { data, error } = await supabase
      .from("student_checkpoint_notes")
      .upsert(
        {
          school_id: schoolId,
          student_id: studentId,
          notes,
          created_by: createdBy || null,
        },
        { onConflict: "school_id,student_id" },
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ========================
  // ATTENDANCE INTEGRATION (Premium)
  // ========================

  /**
   * For each student in the school, return their last entry/exit record for the
   * given checkpoint on the given date, their active evening leave return time,
   * and a `suggest_absent` flag.
   *
   * The Take Attendance page uses this to pre-populate extra columns and
   * pre-select absent codes for students that appear to be missing.
   */
  static async getAttendanceIntegration(
    schoolId: string,
    checkpointId: string,
    date: string,           // YYYY-MM-DD
    currentTime: string,    // HH:MM
  ) {
    const dayStart = `${date}T00:00:00`;
    const dayEnd   = `${date}T23:59:59`;

    // Day of week for evening leave matching (0=Sun … 6=Sat)
    const dow = new Date(`${date}T00:00:00`).getDay();

    // All STUDENT entry/exit records for the checkpoint today
    const { data: records, error: recErr } = await supabase
      .from("entry_exit_records")
      .select("person_id, record_type, recorded_at")
      .eq("school_id", schoolId)
      .eq("checkpoint_id", checkpointId)
      .eq("person_type", "STUDENT")
      .gte("recorded_at", dayStart)
      .lte("recorded_at", dayEnd)
      .order("recorded_at", { ascending: false });

    if (recErr) throw recErr;

    // Build map: student_id → { last_record_type, last_record_time }
    const recordMap = new Map<string, { type: string; time: string }>();
    for (const r of records || []) {
      if (!recordMap.has(r.person_id)) {
        // First (most recent) record wins
        recordMap.set(r.person_id, {
          type: r.record_type,
          time: r.recorded_at,
        });
      }
    }

    // Active evening leaves that cover today
    const { data: leaves, error: lvErr } = await supabase
      .from("evening_leaves")
      .select("student_id, authorized_return_time, checkpoint_id")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .lte("start_date", date)
      .gte("end_date", date);

    if (lvErr) throw lvErr;

    // Filter leaves that apply to today's day_of_week and optionally the same checkpoint
    const leaveMap = new Map<string, string>(); // student_id → return_time (HH:MM)
    for (const lv of leaves || []) {
      const dows: number[] = lv.days_of_week || [];
      if (!dows.includes(dow)) continue;
      if (lv.checkpoint_id && lv.checkpoint_id !== checkpointId) continue;
      // Keep earliest return time if multiple leaves
      const existing = leaveMap.get(lv.student_id);
      if (!existing || lv.authorized_return_time < existing) {
        leaveMap.set(lv.student_id, lv.authorized_return_time);
      }
    }

    // Collect all unique student IDs across both records and leaves
    const allStudentIds = [
      ...new Set([...recordMap.keys(), ...leaveMap.keys()]),
    ];

    // Build the result array
    const result = allStudentIds.map((studentId) => {
      const rec = recordMap.get(studentId);
      const returnTime = leaveMap.get(studentId) || null;

      // suggest_absent when:
      //   – no record at all AND
      //   – (no evening leave OR evening leave return time has already passed)
      const noRecord = !rec;
      const returnTimePassed = returnTime
        ? currentTime >= returnTime.slice(0, 5)
        : true;
      const suggestAbsent = noRecord && returnTimePassed;

      return {
        student_id: studentId,
        last_record_type: rec?.type || null,
        last_record_time: rec?.time || null,
        evening_leave_return_time: returnTime,
        suggest_absent: suggestAbsent,
      };
    });

    return result;
  }
}
