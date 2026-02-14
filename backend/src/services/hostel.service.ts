import { supabase } from "../config/supabase";

export class HostelService {
  // ─── BUILDINGS ──────────────────────────────────────────────

  static async getBuildings(schoolId: string) {
    const { data, error } = await supabase
      .from("hostel_buildings")
      .select("*, hostel_rooms(id)")
      .eq("school_id", schoolId)
      .order("name");

    if (error) throw error;

    return (data || []).map((b: any) => ({
      ...b,
      room_count: b.hostel_rooms?.length || 0,
      hostel_rooms: undefined,
    }));
  }

  static async createBuilding(dto: any) {
    const { data, error } = await supabase
      .from("hostel_buildings")
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateBuilding(id: string, schoolId: string, dto: any) {
    const { data, error } = await supabase
      .from("hostel_buildings")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("school_id", schoolId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteBuilding(id: string, schoolId: string) {
    const { error } = await supabase
      .from("hostel_buildings")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);
    if (error) throw error;
  }

  // ─── ROOMS ──────────────────────────────────────────────────

  static async getRooms(schoolId: string, buildingId?: string) {
    let query = supabase
      .from("hostel_rooms")
      .select(
        `
        *,
        hostel_buildings ( name ),
        hostel_room_assignments ( id )
      `,
      )
      .eq("school_id", schoolId)
      .order("room_number");

    if (buildingId) query = query.eq("building_id", buildingId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((r: any) => ({
      ...r,
      building_name: r.hostel_buildings?.name || null,
      occupancy: (r.hostel_room_assignments || []).filter((a: any) => a.id)
        .length,
      hostel_buildings: undefined,
      hostel_room_assignments: undefined,
    }));
  }

  static async getRoomById(id: string) {
    const { data, error } = await supabase
      .from("hostel_rooms")
      .select("*, hostel_buildings ( name )")
      .eq("id", id)
      .single();
    if (error) throw error;
    return { ...data, building_name: data.hostel_buildings?.name || null };
  }

  static async createRoom(dto: any) {
    const { data, error } = await supabase
      .from("hostel_rooms")
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateRoom(id: string, schoolId: string, dto: any) {
    const { data, error } = await supabase
      .from("hostel_rooms")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("school_id", schoolId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteRoom(id: string, schoolId: string) {
    const { error } = await supabase
      .from("hostel_rooms")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);
    if (error) throw error;
  }

  // ─── ASSIGNMENTS ────────────────────────────────────────────

  static async getAssignments(
    schoolId: string,
    filters: { building_id?: string; room_id?: string; active_only?: boolean },
  ) {
    let query = supabase
      .from("hostel_room_assignments")
      .select(
        `
        *,
        hostel_rooms ( room_number, hostel_buildings ( name ) ),
        students ( id, profiles ( first_name, last_name ) )
      `,
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (filters.active_only !== false) query = query.eq("is_active", true);
    if (filters.room_id) query = query.eq("room_id", filters.room_id);

    const { data, error } = await query;
    if (error) throw error;

    let results = (data || []).map((a: any) => ({
      ...a,
      student_name: a.students?.profiles
        ? `${a.students.profiles.first_name || ""} ${a.students.profiles.last_name || ""}`.trim()
        : null,
      room_number: a.hostel_rooms?.room_number || null,
      building_name: a.hostel_rooms?.hostel_buildings?.name || null,
      students: undefined,
      hostel_rooms: undefined,
    }));

    // Filter by building if requested
    if (filters.building_id) {
      // Re-query with building filter via room
      const { data: rooms } = await supabase
        .from("hostel_rooms")
        .select("id")
        .eq("building_id", filters.building_id);
      const roomIds = (rooms || []).map((r: any) => r.id);
      results = results.filter((a: any) => roomIds.includes(a.room_id));
    }

    return results;
  }

  static async assignStudent(dto: any) {
    // Check room capacity
    const { data: room } = await supabase
      .from("hostel_rooms")
      .select("capacity")
      .eq("id", dto.room_id)
      .single();

    if (!room) throw new Error("Room not found");

    const { count } = await supabase
      .from("hostel_room_assignments")
      .select("id", { count: "exact", head: true })
      .eq("room_id", dto.room_id)
      .eq("is_active", true);

    if ((count || 0) >= room.capacity) {
      throw new Error("Room is at full capacity");
    }

    // Check if student already has active assignment
    const { data: existing } = await supabase
      .from("hostel_room_assignments")
      .select("id")
      .eq("student_id", dto.student_id)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      throw new Error(
        "Student already has an active room assignment. Release them first.",
      );
    }

    const { data, error } = await supabase
      .from("hostel_room_assignments")
      .insert({
        room_id: dto.room_id,
        student_id: dto.student_id,
        school_id: dto.school_id,
        assigned_date:
          dto.assigned_date || new Date().toISOString().split("T")[0],
        notes: dto.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async releaseStudent(assignmentId: string) {
    const { data, error } = await supabase
      .from("hostel_room_assignments")
      .update({
        is_active: false,
        released_date: new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async getStudentRoom(studentId: string) {
    const { data, error } = await supabase
      .from("hostel_room_assignments")
      .select(
        `
        *,
        hostel_rooms ( room_number, floor, hostel_buildings ( name ) )
      `,
      )
      .eq("student_id", studentId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      room_number: data.hostel_rooms?.room_number || null,
      floor: data.hostel_rooms?.floor || null,
      building_name: data.hostel_rooms?.hostel_buildings?.name || null,
    };
  }

  // ─── VISITS ─────────────────────────────────────────────────

  static async getVisits(
    schoolId: string,
    filters: {
      student_id?: string;
      room_id?: string;
      date_from?: string;
      date_to?: string;
      active_only?: boolean;
    },
  ) {
    let query = supabase
      .from("hostel_visits")
      .select(
        `
        *,
        students ( id, profiles ( first_name, last_name ) ),
        hostel_rooms ( room_number )
      `,
      )
      .eq("school_id", schoolId)
      .order("check_in", { ascending: false });

    if (filters.student_id) query = query.eq("student_id", filters.student_id);
    if (filters.room_id) query = query.eq("room_id", filters.room_id);
    if (filters.date_from) query = query.gte("check_in", filters.date_from);
    if (filters.date_to)
      query = query.lte("check_in", filters.date_to + "T23:59:59");
    if (filters.active_only) query = query.is("check_out", null);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((v: any) => ({
      ...v,
      student_name: v.students?.profiles
        ? `${v.students.profiles.first_name || ""} ${v.students.profiles.last_name || ""}`.trim()
        : null,
      room_number: v.hostel_rooms?.room_number || null,
      students: undefined,
      hostel_rooms: undefined,
    }));
  }

  static async createVisit(dto: any) {
    // If no room_id provided, try to get the student's current room
    if (!dto.room_id) {
      const assignment = await this.getStudentRoom(dto.student_id);
      if (assignment) {
        dto.room_id = assignment.room_id;
      }
    }

    const { data, error } = await supabase
      .from("hostel_visits")
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async checkOutVisit(visitId: string) {
    const { data, error } = await supabase
      .from("hostel_visits")
      .update({ check_out: new Date().toISOString() })
      .eq("id", visitId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ─── RENTAL FEES ────────────────────────────────────────────

  static async getRentalFees(
    schoolId: string,
    filters: {
      student_id?: string;
      status?: string;
      period_start?: string;
      period_end?: string;
    },
  ) {
    let query = supabase
      .from("hostel_rental_fees")
      .select(
        `
        *,
        students ( id, profiles ( first_name, last_name ) ),
        hostel_rooms ( room_number )
      `,
      )
      .eq("school_id", schoolId)
      .order("period_start", { ascending: false });

    if (filters.student_id) query = query.eq("student_id", filters.student_id);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.period_start)
      query = query.gte("period_start", filters.period_start);
    if (filters.period_end) query = query.lte("period_end", filters.period_end);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((f: any) => ({
      ...f,
      student_name: f.students?.profiles
        ? `${f.students.profiles.first_name || ""} ${f.students.profiles.last_name || ""}`.trim()
        : null,
      room_number: f.hostel_rooms?.room_number || null,
      students: undefined,
      hostel_rooms: undefined,
    }));
  }

  static async generateRentalFees(dto: {
    school_id: string;
    period_start: string;
    period_end: string;
    factor?: number;
    building_id?: string;
  }) {
    const factor = dto.factor ?? 1;

    // Get all active assignments
    let assignmentQuery = supabase
      .from("hostel_room_assignments")
      .select(
        `
        id, student_id, room_id,
        hostel_rooms ( price_per_month, building_id )
      `,
      )
      .eq("school_id", dto.school_id)
      .eq("is_active", true);

    const { data: assignments, error: aErr } = await assignmentQuery;
    if (aErr) throw aErr;

    let filtered = assignments || [];

    // Filter by building if requested
    if (dto.building_id) {
      filtered = filtered.filter(
        (a: any) => a.hostel_rooms?.building_id === dto.building_id,
      );
    }

    if (filtered.length === 0) {
      return { fees_created: 0, total_amount: 0 };
    }

    const feesToInsert = filtered.map((a: any) => {
      const baseAmount = Number(a.hostel_rooms?.price_per_month || 0);
      const finalAmount = Math.round(baseAmount * factor * 100) / 100;
      return {
        room_assignment_id: a.id,
        student_id: a.student_id,
        room_id: a.room_id,
        school_id: dto.school_id,
        period_start: dto.period_start,
        period_end: dto.period_end,
        base_amount: baseAmount,
        factor,
        final_amount: finalAmount,
        status: "pending",
        amount_paid: 0,
      };
    });

    const { data, error } = await supabase
      .from("hostel_rental_fees")
      .insert(feesToInsert)
      .select();

    if (error) throw error;

    const totalAmount = feesToInsert.reduce(
      (sum, f) => sum + f.final_amount,
      0,
    );
    return { fees_created: (data || []).length, total_amount: totalAmount };
  }

  static async recordFeePayment(feeId: string, amount: number, notes?: string) {
    // Get current fee
    const { data: fee, error: fErr } = await supabase
      .from("hostel_rental_fees")
      .select("*")
      .eq("id", feeId)
      .single();

    if (fErr || !fee) throw new Error("Fee not found");

    const newAmountPaid = Number(fee.amount_paid) + amount;
    const newStatus =
      newAmountPaid >= Number(fee.final_amount) ? "paid" : "partial";

    const { data, error } = await supabase
      .from("hostel_rental_fees")
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : fee.paid_at,
        notes: notes || fee.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── FILES ──────────────────────────────────────────────────

  static async getFiles(entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from("hostel_room_files")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async addFile(dto: any) {
    const { data, error } = await supabase
      .from("hostel_room_files")
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteFile(fileId: string, schoolId: string) {
    const { error } = await supabase
      .from("hostel_room_files")
      .delete()
      .eq("id", fileId)
      .eq("school_id", schoolId);
    if (error) throw error;
  }

  // ─── SEARCH ─────────────────────────────────────────────────

  static async searchStudentsByBuilding(schoolId: string, buildingId: string) {
    const { data: rooms } = await supabase
      .from("hostel_rooms")
      .select("id")
      .eq("building_id", buildingId);

    const roomIds = (rooms || []).map((r: any) => r.id);
    if (roomIds.length === 0) return [];

    const { data, error } = await supabase
      .from("hostel_room_assignments")
      .select(
        `
        student_id,
        hostel_rooms ( room_number ),
        students ( id, admission_number, profiles ( first_name, last_name ) )
      `,
      )
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in("room_id", roomIds);

    if (error) throw error;

    return (data || []).map((a: any) => ({
      student_id: a.student_id,
      student_name: a.students?.profiles
        ? `${a.students.profiles.first_name || ""} ${a.students.profiles.last_name || ""}`.trim()
        : null,
      admission_number: a.students?.admission_number || null,
      room_number: a.hostel_rooms?.room_number || null,
    }));
  }

  static async searchStudentsByRoom(schoolId: string, roomId: string) {
    const { data, error } = await supabase
      .from("hostel_room_assignments")
      .select(
        `
        student_id,
        students ( id, admission_number, profiles ( first_name, last_name ) )
      `,
      )
      .eq("school_id", schoolId)
      .eq("room_id", roomId)
      .eq("is_active", true);

    if (error) throw error;

    return (data || []).map((a: any) => ({
      student_id: a.student_id,
      student_name: a.students?.profiles
        ? `${a.students.profiles.first_name || ""} ${a.students.profiles.last_name || ""}`.trim()
        : null,
      admission_number: a.students?.admission_number || null,
    }));
  }

  // ─── DASHBOARD STATS ───────────────────────────────────────

  static async getStats(schoolId: string) {
    const [buildings, rooms, activeAssignments, activeVisits] =
      await Promise.all([
        supabase
          .from("hostel_buildings")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("is_active", true),
        supabase
          .from("hostel_rooms")
          .select("id, capacity", { count: "exact" })
          .eq("school_id", schoolId)
          .eq("is_active", true),
        supabase
          .from("hostel_room_assignments")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("is_active", true),
        supabase
          .from("hostel_visits")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .is("check_out", null),
      ]);

    const totalCapacity = (rooms.data || []).reduce(
      (sum: number, r: any) => sum + (r.capacity || 0),
      0,
    );

    return {
      total_buildings: buildings.count || 0,
      total_rooms: rooms.count || 0,
      total_capacity: totalCapacity,
      occupied_beds: activeAssignments.count || 0,
      occupancy_rate:
        totalCapacity > 0
          ? Math.round(((activeAssignments.count || 0) / totalCapacity) * 100)
          : 0,
      active_visitors: activeVisits.count || 0,
    };
  }

  // ─── CRON: REMOVE INACTIVE STUDENTS ────────────────────────

  static async removeInactiveStudents() {
    // Find active assignments where the student's profile is inactive
    const { data: assignments, error } = await supabase
      .from("hostel_room_assignments")
      .select(
        `
        id, student_id,
        students ( profile_id, profiles ( is_active ) )
      `,
      )
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching hostel assignments for cleanup:", error);
      return { released: 0 };
    }

    const toRelease = (assignments || []).filter(
      (a: any) => a.students?.profiles?.is_active === false,
    );

    if (toRelease.length === 0) return { released: 0 };

    const ids = toRelease.map((a: any) => a.id);
    const { error: updateError } = await supabase
      .from("hostel_room_assignments")
      .update({
        is_active: false,
        released_date: new Date().toISOString().split("T")[0],
        notes: "Auto-released: student marked inactive",
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateError) {
      console.error("Error releasing inactive hostel students:", updateError);
      return { released: 0 };
    }

    console.log(
      `🏠 Auto-released ${ids.length} inactive student(s) from hostel rooms`,
    );
    return { released: ids.length };
  }
}
