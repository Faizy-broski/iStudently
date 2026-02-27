import { supabase } from "../config/supabase";
import { EntryExitService } from "./entryExit.service";
import {
  AutomaticRecord,
  AutomaticRecordException,
} from "../types/index";

// ─────────────────────────────────────────────────────────────────────────────
// Automatic Records Service (Premium)
// ─────────────────────────────────────────────────────────────────────────────

export class AutomaticRecordsService {
  // ===========================================================================
  // AUTOMATIC RECORD RULES — CRUD
  // ===========================================================================

  static async getAll(schoolId: string): Promise<AutomaticRecord[]> {
    const { data, error } = await supabase
      .from("automatic_records")
      .select("*, checkpoints(name)")
      .eq("school_id", schoolId)
      .order("day_of_week")
      .order("scheduled_time");

    if (error) throw error;

    return (data || []).map((r: any) => ({
      ...r,
      checkpoint_name: r.checkpoints?.name || null,
    }));
  }

  static async getById(id: string): Promise<AutomaticRecord> {
    const { data, error } = await supabase
      .from("automatic_records")
      .select("*, checkpoints(name)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return { ...data, checkpoint_name: data.checkpoints?.name || null };
  }

  static async create(dto: {
    school_id: string;
    checkpoint_id: string;
    record_type: "ENTRY" | "EXIT";
    day_of_week: number;
    scheduled_time: string;
    target_type?: string;
    target_value?: string | null;
    created_by?: string;
  }): Promise<AutomaticRecord> {
    const { data, error } = await supabase
      .from("automatic_records")
      .insert({
        school_id: dto.school_id,
        checkpoint_id: dto.checkpoint_id,
        record_type: dto.record_type,
        day_of_week: dto.day_of_week,
        scheduled_time: dto.scheduled_time,
        target_type: dto.target_type || "all_students",
        target_value: dto.target_value || null,
        is_active: true,
        created_by: dto.created_by || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(
    id: string,
    dto: Partial<{
      checkpoint_id: string;
      record_type: "ENTRY" | "EXIT";
      day_of_week: number;
      scheduled_time: string;
      target_type: string;
      target_value: string | null;
      is_active: boolean;
    }>,
  ): Promise<AutomaticRecord> {
    const { data, error } = await supabase
      .from("automatic_records")
      .update(dto)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(id: string) {
    const { error } = await supabase
      .from("automatic_records")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  }

  // ===========================================================================
  // EXCEPTIONS — CRUD
  // ===========================================================================

  static async getExceptions(
    automaticRecordId: string,
  ): Promise<AutomaticRecordException[]> {
    const { data, error } = await supabase
      .from("automatic_record_exceptions")
      .select("*")
      .eq("automatic_record_id", automaticRecordId)
      .order("from_date", { ascending: false });

    if (error) throw error;

    // Enrich with person names
    return this.enrichExceptionsWithNames(data || []);
  }

  /**
   * Get all active exceptions for a person today.  Used to exclude from bulk
   * automatic record application.
   */
  static async getActiveExceptionsForPerson(
    personId: string,
    date: string, // YYYY-MM-DD
  ): Promise<AutomaticRecordException[]> {
    const { data, error } = await supabase
      .from("automatic_record_exceptions")
      .select("*")
      .eq("person_id", personId)
      .lte("from_date", date)
      .gte("to_date", date);

    if (error) throw error;
    return data || [];
  }

  static async createException(dto: {
    school_id: string;
    automatic_record_id: string;
    person_id: string;
    person_type: "STUDENT" | "STAFF";
    from_date: string;
    to_date: string;
    reason?: string;
    created_by?: string;
  }): Promise<AutomaticRecordException> {
    const { data, error } = await supabase
      .from("automatic_record_exceptions")
      .insert({
        school_id: dto.school_id,
        automatic_record_id: dto.automatic_record_id,
        person_id: dto.person_id,
        person_type: dto.person_type,
        from_date: dto.from_date,
        to_date: dto.to_date,
        reason: dto.reason || null,
        created_by: dto.created_by || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * List all exceptions across a school, optionally filtered by date range,
   * checkpoint and record_type.  Used by the /exceptions list page.
   */
  static async getSchoolExceptions(
    schoolId: string,
    filters: {
      from_date?: string;
      to_date?: string;
      checkpoint_id?: string;
      record_type?: string;
    } = {},
  ): Promise<(AutomaticRecordException & { checkpoint_id: string; record_type: string; checkpoint_name?: string })[]> {
    let query = supabase
      .from("automatic_record_exceptions")
      .select(
        "*, automatic_records!inner(checkpoint_id, record_type, school_id, checkpoints(name))",
      )
      .eq("automatic_records.school_id", schoolId)
      .order("from_date", { ascending: false });

    if (filters.from_date) query = query.gte("to_date", filters.from_date);
    if (filters.to_date) query = query.lte("from_date", filters.to_date);
    if (filters.checkpoint_id)
      query = query.eq("automatic_records.checkpoint_id", filters.checkpoint_id);
    if (filters.record_type && filters.record_type !== "ENTRY_AND_EXIT")
      query = query.eq("automatic_records.record_type", filters.record_type);

    const { data, error } = await query;
    if (error) throw error;

    const flat = (data || []).map((row: any) => {
      const { automatic_records, ...rest } = row;
      return {
        ...rest,
        checkpoint_id: automatic_records?.checkpoint_id ?? null,
        record_type: automatic_records?.record_type ?? null,
        checkpoint_name: automatic_records?.checkpoints?.name ?? null,
      };
    });

    return this.enrichExceptionsWithNames(flat) as any;
  }

  /**
   * Bulk-create exceptions for multiple persons across all matching rules.
   * Matches rules by school_id and optional checkpoint_id / record_type filters.
   */
  static async bulkCreateExceptions(dto: {
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
    // find matching rules
    let rulesQuery = supabase
      .from("automatic_records")
      .select("id")
      .eq("school_id", dto.school_id)
      .eq("is_active", true);

    if (dto.checkpoint_id) rulesQuery = rulesQuery.eq("checkpoint_id", dto.checkpoint_id);
    if (dto.record_type && dto.record_type !== "ENTRY_AND_EXIT")
      rulesQuery = rulesQuery.eq("record_type", dto.record_type);

    const { data: rules, error: rulesErr } = await rulesQuery;
    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) return { created: 0 };

    const rows = (rules as { id: string }[]).flatMap((rule) =>
      dto.person_ids.map((personId) => ({
        school_id: dto.school_id,
        automatic_record_id: rule.id,
        person_id: personId,
        person_type: dto.person_type,
        from_date: dto.from_date,
        to_date: dto.to_date,
        reason: dto.reason || null,
        created_by: dto.created_by || null,
      })),
    );

    const { error } = await supabase
      .from("automatic_record_exceptions")
      .insert(rows);
    if (error) throw error;

    return { created: rows.length };
  }

  static async deleteException(id: string) {
    const { error } = await supabase
      .from("automatic_record_exceptions")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  }

  // ===========================================================================
  // CORE APPLIER
  // ===========================================================================

  /**
   * Apply all active automatic_records rules for a given school whose
   * day_of_week matches `dayOfWeek` and scheduled_time falls within ±1 minute
   * of `currentTime` (format HH:MM).
   *
   * Called by the per-minute cron job.
   */
  static async applyAutomaticRecords(
    schoolId: string,
    dayOfWeek: number,
    currentTime: string, // HH:MM
    today: string,       // YYYY-MM-DD
  ) {
    // Find matching active rules
    const { data: rules, error } = await supabase
      .from("automatic_records")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .eq("day_of_week", dayOfWeek);

    if (error) throw error;
    if (!rules || rules.length === 0) return [];

    // Parse current time into minutes for ±1 min window
    const [ch, cm] = currentTime.split(":").map(Number);
    const currentMinutes = ch * 60 + cm;

    const matchingRules = rules.filter((r: any) => {
      const [rh, rm] = (r.scheduled_time as string).slice(0, 5).split(":").map(Number);
      const ruleMinutes = rh * 60 + rm;
      return Math.abs(ruleMinutes - currentMinutes) <= 1;
    });

    if (matchingRules.length === 0) return [];

    const results: any[] = [];

    for (const rule of matchingRules) {
      // 1. Resolve target audience
      const personIds: string[] = await this.resolveTargetAudience(
        rule.school_id,
        rule.target_type,
        rule.target_value,
      );

      if (personIds.length === 0) continue;

      // 2. Get all exceptions covering today for the rule
      const { data: exceptions } = await supabase
        .from("automatic_record_exceptions")
        .select("person_id")
        .eq("automatic_record_id", rule.id)
        .lte("from_date", today)
        .gte("to_date", today);

      const excludedIds = new Set(
        (exceptions || []).map((e: any) => e.person_id),
      );

      // 3. Filter out excluded persons
      const eligibleIds = personIds.filter((id) => !excludedIds.has(id));

      if (eligibleIds.length === 0) continue;

      // 4. Bulk insert records
      const personType =
        rule.target_type === "all_staff" || rule.target_type === "staff_profile"
          ? "STAFF"
          : "STUDENT";

      try {
        const inserted = await EntryExitService.createBulkRecords({
          school_id: rule.school_id,
          checkpoint_id: rule.checkpoint_id,
          person_ids: eligibleIds,
          person_type: personType,
          record_type: rule.record_type,
          description: `Auto-generated from rule ${rule.id}`,
        });

        results.push({
          rule_id: rule.id,
          checkpoint_id: rule.checkpoint_id,
          record_type: rule.record_type,
          target_count: eligibleIds.length,
          inserted: inserted?.length || 0,
        });
      } catch (err) {
        console.error(`[AutomaticRecords] Failed to apply rule ${rule.id}:`, err);
      }
    }

    return results;
  }

  /**
   * Run automatic record cleanup for all schools: delete records older than
   * the school-configured threshold (hard-coded to 365 days if not set).
   * Also exposed for direct calls from the nightly cron.
   */
  static async runNightlyCleanupAllSchools() {
    const { data: schools } = await supabase
      .from("schools")
      .select("id")
      .eq("is_active", true);

    for (const school of schools || []) {
      try {
        await EntryExitService.deleteOldRecords(school.id, 365);
      } catch (err) {
        console.error(`[AutomaticRecords] Nightly cleanup failed for school ${school.id}:`, err);
      }
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Resolve person IDs based on target_type and target_value.
   */
  private static async resolveTargetAudience(
    schoolId: string,
    targetType: string,
    targetValue: string | null,
  ): Promise<string[]> {
    if (targetType === "all_students") {
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_active", true);
      return (data || []).map((s: any) => s.id);
    }

    if (targetType === "grade_level") {
      if (!targetValue) return [];
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .eq("grade_level_id", targetValue);
      return (data || []).map((s: any) => s.id);
    }

    if (targetType === "all_staff") {
      const { data } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_active", true);
      return (data || []).map((s: any) => s.id);
    }

    if (targetType === "staff_profile") {
      if (!targetValue) return [];
      const { data } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .eq("profile_type", targetValue);
      return (data || []).map((s: any) => s.id);
    }

    return [];
  }

  private static async enrichExceptionsWithNames(
    exceptions: any[],
  ): Promise<AutomaticRecordException[]> {
    if (exceptions.length === 0) return [];

    const studentIds = [
      ...new Set(
        exceptions
          .filter((e) => e.person_type === "STUDENT")
          .map((e) => e.person_id),
      ),
    ];
    const staffIds = [
      ...new Set(
        exceptions
          .filter((e) => e.person_type !== "STUDENT")
          .map((e) => e.person_id),
      ),
    ];

    const nameMap = new Map<string, string>();

    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select("id, profiles(first_name, last_name)")
        .in("id", studentIds);
      (students || []).forEach((s: any) => {
        if (s.profiles) {
          nameMap.set(
            s.id,
            `${s.profiles.first_name || ""} ${s.profiles.last_name || ""}`.trim(),
          );
        }
      });
    }

    if (staffIds.length > 0) {
      const { data: staffList } = await supabase
        .from("staff")
        .select("id, profile:profiles!staff_profile_id_fkey(first_name, last_name)")
        .in("id", staffIds);
      (staffList || []).forEach((s: any) => {
        if (s.profile) {
          nameMap.set(
            s.id,
            `${s.profile.first_name || ""} ${s.profile.last_name || ""}`.trim(),
          );
        }
      });
    }

    return exceptions.map((e) => ({
      ...e,
      person_name: nameMap.get(e.person_id) || null,
    }));
  }
}
