import { supabase } from "../config/supabase";
import { CreateEveningLeaveDTO, UpdateEveningLeaveDTO } from "../types/index";

export class EveningLeaveService {
  static async create(dto: CreateEveningLeaveDTO) {
    const { data, error } = await supabase
      .from("evening_leaves")
      .insert({
        school_id: dto.school_id,
        student_id: dto.student_id,
        checkpoint_id: dto.checkpoint_id || null,
        start_date: dto.start_date,
        end_date: dto.end_date,
        days_of_week: dto.days_of_week,
        authorized_return_time: dto.authorized_return_time,
        reason: dto.reason || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getAll(filters: {
    school_id: string;
    student_id?: string;
    is_active?: boolean;
    date?: string;
  }) {
    let query = supabase
      .from("evening_leaves")
      .select(
        `
        *,
        students (
          id,
          profiles (
            first_name,
            last_name
          )
        )
      `,
      )
      .eq("school_id", filters.school_id);

    if (filters.student_id) query = query.eq("student_id", filters.student_id);
    if (filters.is_active !== undefined)
      query = query.eq("is_active", filters.is_active);
    if (filters.date) {
      query = query
        .lte("start_date", filters.date)
        .gte("end_date", filters.date);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;

    // Flatten student name
    return (data || []).map((leave: any) => ({
      ...leave,
      student_name: leave.students?.profiles
        ? `${leave.students.profiles.first_name || ""} ${leave.students.profiles.last_name || ""}`.trim()
        : null,
    }));
  }

  static async getById(id: string) {
    const { data, error } = await supabase
      .from("evening_leaves")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  }

  static async update(id: string, dto: UpdateEveningLeaveDTO) {
    const updates: any = {};
    if (dto.checkpoint_id !== undefined)
      updates.checkpoint_id = dto.checkpoint_id;
    if (dto.start_date !== undefined) updates.start_date = dto.start_date;
    if (dto.end_date !== undefined) updates.end_date = dto.end_date;
    if (dto.days_of_week !== undefined) updates.days_of_week = dto.days_of_week;
    if (dto.authorized_return_time !== undefined)
      updates.authorized_return_time = dto.authorized_return_time;
    if (dto.reason !== undefined) updates.reason = dto.reason;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;

    const { data, error } = await supabase
      .from("evening_leaves")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(id: string) {
    const { error } = await supabase
      .from("evening_leaves")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  }

  static async getActiveForStudent(schoolId: string, studentId: string) {
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();

    const { data, error } = await supabase
      .from("evening_leaves")
      .select(
        `
        *,
        students (
          id,
          profiles (
            first_name,
            last_name
          )
        )
      `,
      )
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("is_active", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .contains("days_of_week", [dayOfWeek]);

    if (error) throw error;
    return (data || []).map((leave: any) => ({
      ...leave,
      student_name: leave.students?.profiles
        ? `${leave.students.profiles.first_name || ""} ${leave.students.profiles.last_name || ""}`.trim()
        : null,
    }));
  }

  static async getReport(schoolId: string, date?: string) {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date(targetDate).getDay();

    // Get all active evening leaves for this date with student names
    const { data: leaves, error } = await supabase
      .from("evening_leaves")
      .select(
        `
        *,
        students (
          id,
          profiles (
            first_name,
            last_name
          )
        )
      `,
      )
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .lte("start_date", targetDate)
      .gte("end_date", targetDate)
      .contains("days_of_week", [dayOfWeek]);

    if (error) throw error;

    // Get today's entry records to see who came back
    const studentIds = (leaves || []).map((l) => l.student_id);
    if (studentIds.length === 0) return [];

    const { data: records } = await supabase
      .from("entry_exit_records")
      .select("*")
      .eq("school_id", schoolId)
      .eq("record_type", "ENTRY")
      .in("person_id", studentIds)
      .gte("recorded_at", targetDate)
      .lte("recorded_at", targetDate + "T23:59:59");

    // Combine leave info with return records
    return (leaves || []).map((leave: any) => {
      const returnRecord = (records || []).find(
        (r) => r.person_id === leave.student_id,
      );
      return {
        ...leave,
        student_name: leave.students?.profiles
          ? `${leave.students.profiles.first_name || ""} ${leave.students.profiles.last_name || ""}`.trim()
          : null,
        has_returned: !!returnRecord,
        return_time: returnRecord?.recorded_at || null,
        is_late: returnRecord
          ? returnRecord.recorded_at >
            `${targetDate}T${leave.authorized_return_time}`
          : false,
      };
    });
  }
}
