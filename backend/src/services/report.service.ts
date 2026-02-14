import { supabase } from "../config/supabase";

export class ReportService {
  static async generate(queryParams: any) {
    let query = supabase
      .from("entry_exit_records")
      .select("*")
      .gte("created_at", queryParams.from)
      .lte("created_at", queryParams.to);

    if (queryParams.personType)
      query = query.eq("person_type", queryParams.personType);

    if (queryParams.recordType)
      query = query.eq("record_type", queryParams.recordType);

    return query;
  }
}
