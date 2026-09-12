import { supabase } from '../../config/supabase';
import { WORLDS } from './content';
import { worldStats, graduated, rankIndex, emptyProgress, type QaidaProgress as EngineProgress } from './progress-engine';

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
  
  /**
   * Shape mirrors the original module's report/route.ts exactly (students[]
   * with per-student derived stats + worldCompletion[] + classSize) — the
   * ported QaidaClassReport.tsx component reads that shape directly
   * (`r.name.replace(...)`, `r.done`, `r.totalStations`, ...), so returning
   * raw qaida_progress rows here (as this used to) left every field on the
   * page undefined/throwing. accuracy/graduated/done are computed from the
   * row's `state` via progress-engine.ts, not read off the row's own
   * denormalized accuracy/graduated columns — those columns exist for cheap
   * DB-level filtering elsewhere, not as the display source of truth.
   */
  async listClassProgress(schoolId: string, campusId: string, academicYearId: string) {
    let query = supabase
      .from('qaida_progress')
      .select('profile_id, state, updated_at')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId);

    if (campusId) {
      query = query.eq('campus_id', campusId);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const profileIds = (rows || []).map((r: any) => r.profile_id as string);
    if (profileIds.length === 0) {
      return { students: [], worldCompletion: WORLDS.map((w) => ({ id: w.id, completed: 0 })), classSize: 0 };
    }

    const [{ data: profiles }, { data: studentLinks }] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name').in('id', profileIds),
      supabase.from('students').select('profile_id, grade_level_id, section_id').in('profile_id', profileIds),
    ]);

    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
    const linkByProfile = new Map((studentLinks || []).map((s: any) => [s.profile_id, s]));

    const gradeLevelIds = [...new Set((studentLinks || []).map((s: any) => s.grade_level_id).filter(Boolean))];
    const sectionIds = [...new Set((studentLinks || []).map((s: any) => s.section_id).filter(Boolean))];
    const [{ data: gradeLevels }, { data: sections }] = await Promise.all([
      gradeLevelIds.length ? supabase.from('grade_levels').select('id, name').in('id', gradeLevelIds) : Promise.resolve({ data: [] as any[] }),
      sectionIds.length ? supabase.from('sections').select('id, name').in('id', sectionIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const gradeNameById = new Map((gradeLevels || []).map((g: any) => [g.id, g.name]));
    const sectionNameById = new Map((sections || []).map((s: any) => [s.id, s.name]));

    const totalStations = WORLDS.reduce((a, w) => a + w.stations.length, 0);
    const progressByProfile = new Map<string, EngineProgress>();

    const students = (rows || []).map((row: any) => {
      const progress: EngineProgress = (row.state as EngineProgress) || emptyProgress();
      progressByProfile.set(row.profile_id, progress);

      const profile = profileById.get(row.profile_id);
      const link = linkByProfile.get(row.profile_id);
      const done = WORLDS.reduce((a, w) => a + worldStats(progress, w).done, 0);
      const stars = Object.values(progress.stations).reduce((a, s) => a + s.stars, 0);
      const accuracy = progress.stats.answered
        ? Math.round((progress.stats.correct / progress.stats.answered) * 100)
        : 0;

      return {
        profileId: row.profile_id as string,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || row.profile_id,
        gradeLevelName: link?.grade_level_id ? gradeNameById.get(link.grade_level_id) ?? null : null,
        sectionName: link?.section_id ? sectionNameById.get(link.section_id) ?? null : null,
        xp: progress.xp,
        rankIndex: rankIndex(progress.xp),
        done,
        totalStations,
        stars,
        accuracy,
        minutes: Math.round(progress.stats.seconds / 60),
        graduated: graduated(progress),
        lastActiveAt: row.updated_at as string | null,
      };
    }).sort((a, b) => b.xp - a.xp);

    const worldCompletion = WORLDS.map((w) => ({
      id: w.id,
      completed: [...progressByProfile.values()].filter((p) => worldStats(p, w).complete).length,
    }));

    return { students, worldCompletion, classSize: students.length };
  }
}

export const qaidaService = new QaidaService();
