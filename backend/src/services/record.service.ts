import { supabase } from '../config/supabase'
import { CreateRecordDTO } from "../types/index";

export class RecordService {
  static async getLastRecord(personId: string) {
    const { data } = await supabase
      .from("entry_exit_records")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  static async create(data: CreateRecordDTO) {
    const last = await this.getLastRecord(data.personId);

    if (data.recordType === "ENTRY" && last?.record_type === "ENTRY") {
      throw new Error("Person already inside");
    }

    if (data.recordType === "EXIT" && last?.record_type !== "ENTRY") {
      throw new Error("Cannot exit without entry");
    }

    const { data: inserted, error } = await supabase
      .from("entry_exit_records")
      .insert({
        person_id: data.personId,
        person_type: data.personType,
        record_type: data.recordType,
        description: data.description
      })
      .select()
      .single();

    if (error) throw error;
    return inserted;
  }

  static async list(filters: any) {
    let query = supabase.from("entry_exit_records").select("*");

    if (filters.personType)
      query = query.eq("person_type", filters.personType);

    if (filters.recordType)
      query = query.eq("record_type", filters.recordType);

    return query;
  }
}
