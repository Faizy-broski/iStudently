import { supabase } from "../config/supabase";
import {
  CreateCheckpointDTO,
  UpdateCheckpointDTO,
  CreateEntryExitDTO,
  EntryStatus,
} from "../types/index";

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

  static async createRecord(dto: CreateEntryExitDTO) {
    const status = await this.resolveStatus(dto.checkpoint_id, dto.record_type);

    const { data, error } = await supabase
      .from("entry_exit_records")
      .insert({
        school_id: dto.school_id,
        checkpoint_id: dto.checkpoint_id,
        person_id: dto.person_id,
        person_type: dto.person_type,
        record_type: dto.record_type,
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
    return enriched[0];
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
}
