import { supabase } from '../../config/supabase';

// Generic CRUD over the 8-level curriculum tree — every level shares the
// same shape (id, code/key, name_ar, name_en, sort_order, one parent FK),
// so one parameterized service covers all of them instead of 8 near-
// identical files. Global/shared reference data — no school_id anywhere.

export type CurriculumLevel = 'stages' | 'grades' | 'tracks' | 'subjects' | 'terms' | 'units' | 'lessons' | 'outcomes';

interface LevelConfig {
  table: string;
  parentCol: string | null; // primary parent FK column used for ?parent_id filtering
  hasCode: boolean; // stages/terms use `key` instead of `code`
}

const LEVELS: Record<CurriculumLevel, LevelConfig> = {
  stages: { table: 'qirtasi_education_stages', parentCol: null, hasCode: false },
  grades: { table: 'qirtasi_grades', parentCol: 'stage_id', hasCode: true },
  tracks: { table: 'qirtasi_tracks', parentCol: 'grade_id', hasCode: true },
  subjects: { table: 'qirtasi_subjects', parentCol: 'grade_id', hasCode: true },
  terms: { table: 'qirtasi_terms', parentCol: null, hasCode: false },
  units: { table: 'qirtasi_units', parentCol: 'subject_id', hasCode: true },
  lessons: { table: 'qirtasi_lessons', parentCol: 'unit_id', hasCode: true },
  outcomes: { table: 'qirtasi_learning_outcomes', parentCol: 'lesson_id', hasCode: false },
};

export function getLevelConfig(level: string): LevelConfig | undefined {
  return LEVELS[level as CurriculumLevel];
}

class QirtasiCurriculumService {
  async list(level: CurriculumLevel, parentId?: string): Promise<any[]> {
    const cfg = LEVELS[level];
    let query = supabase.from(cfg.table).select('*').order('sort_order', { ascending: true });
    if (parentId && cfg.parentCol) query = query.eq(cfg.parentCol, parentId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async get(level: CurriculumLevel, id: string): Promise<any> {
    const cfg = LEVELS[level];
    const { data, error } = await supabase.from(cfg.table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(level: CurriculumLevel, payload: Record<string, any>): Promise<any> {
    const cfg = LEVELS[level];
    const { data, error } = await supabase.from(cfg.table).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async update(level: CurriculumLevel, id: string, payload: Record<string, any>): Promise<any> {
    const cfg = LEVELS[level];
    const { data, error } = await supabase
      .from(cfg.table)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async remove(level: CurriculumLevel, id: string): Promise<{ success: true }> {
    const cfg = LEVELS[level];
    const { error } = await supabase.from(cfg.table).delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }
}

export const qirtasiCurriculumService = new QirtasiCurriculumService();
