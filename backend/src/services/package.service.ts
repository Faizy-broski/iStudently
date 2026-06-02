import { supabase } from "../config/supabase";
import { CreatePackageDTO } from "../types/index";

export class PackageService {
  static async create(dto: CreatePackageDTO) {
    const { data, error } = await supabase
      .from("package_deliveries")
      .insert({
        school_id: dto.school_id,
        student_id: dto.student_id,
        description: dto.description || null,
        sender: dto.sender || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getAll(filters: {
    school_id: string;
    student_id?: string;
    status?: string;
    limit?: number;
  }) {
    let query = supabase
      .from("package_deliveries")
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
    if (filters.status) query = query.eq("status", filters.status);

    query = query.order("created_at", { ascending: false });
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;

    // Flatten student name
    return (data || []).map((pkg: any) => ({
      ...pkg,
      student_name: pkg.students?.profiles
        ? `${pkg.students.profiles.first_name || ""} ${pkg.students.profiles.last_name || ""}`.trim()
        : null,
    }));
  }

  static async getPending(schoolId: string) {
    const { data, error } = await supabase
      .from("package_deliveries")
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
      .eq("status", "pending")
      .order("received_at", { ascending: false });

    if (error) throw error;

    // Flatten student name
    return (data || []).map((pkg: any) => ({
      ...pkg,
      student_name: pkg.students?.profiles
        ? `${pkg.students.profiles.first_name || ""} ${pkg.students.profiles.last_name || ""}`.trim()
        : null,
    }));
  }

  static async pickup(id: string) {
    const { data, error } = await supabase
      .from("package_deliveries")
      .update({
        status: "collected",
        collected_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getStudentPendingPackages(schoolId: string, studentId: string) {
    const { data, error } = await supabase
      .from("package_deliveries")
      .select("*")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("status", "pending");

    if (error) throw error;
    return data || [];
  }
}
