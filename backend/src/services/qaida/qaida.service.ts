import { supabase } from '../../config/supabase';

export interface QaidaProgress {
  id?: string;
  school_id: string;
  campus_id?: string;
  academic_year_id: string;
  profile_id: string;
  state: any;
  xp: number;
  stations_completed: number;
  stars_total: number;
  accuracy: number;
  graduated: boolean;
  graduated_at?: string;
}

export interface QaidaSession {
  id?: string;
  school_id: string;
  campus_id?: string;
  academic_year_id: string;
  profile_id: string;
  world_id: string;
  station_id: string;
  is_review: boolean;
  seconds: number;
  items: any;
  accuracy: number;
  stars: number;
  xp_awarded: number;
}

export class QaidaService {
  async getProgress(profileId: string, academicYearId: string) {
    const { data, error } = await supabase
      .from('qaida_progress')
      .select('*')
      .eq('profile_id', profileId)
      .eq('academic_year_id', academicYearId)
      .maybeSingle();
      
    if (error) throw error;
    return data;
  }

  async saveProgress(progress: QaidaProgress) {
    const { data, error } = await supabase
      .from('qaida_progress')
      .upsert(progress, { onConflict: 'profile_id,academic_year_id' })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async insertSession(session: QaidaSession) {
    const { data, error } = await supabase
      .from('qaida_sessions')
      .insert(session)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async listSessions(profileId: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('qaida_sessions')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    return data;
  }
  
  async listClassProgress(schoolId: string, campusId: string, academicYearId: string) {
    // This will likely need joins with profiles for names, but basic for now
    let query = supabase
      .from('qaida_progress')
      .select('*, profiles(first_name, last_name, avatar_url, role)')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId);
      
    if (campusId) {
        query = query.eq('campus_id', campusId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

export const qaidaService = new QaidaService();
