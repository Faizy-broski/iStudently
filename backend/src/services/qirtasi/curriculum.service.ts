import { supabase } from '../../config/supabase';

// Generic CRUD over the 8-level curriculum tree — every level shares the
// same shape (id, code/key, name_ar, name_en, sort_order, one parent FK),
// so one parameterized service covers all of them instead of 8 near-
// identical files. Each main school owns its own tree (school_id = the main
// school; campuses share it — migrations/qirtasi_curriculum_per_school.sql).
// Terms are the one shared level (a fixed T1/T2 pair): readable by all,
// not editable here.

export type CurriculumLevel = 'stages' | 'grades' | 'tracks' | 'subjects' | 'terms' | 'units' | 'lessons' | 'outcomes';

interface LevelConfig {
  table: string;
  parentCol: string | null; // primary parent FK column used for ?parent_id filtering
  hasCode: boolean; // stages/terms use `key` instead of `code`
  shared?: boolean; // no school_id: same rows for every school, read-only
}

/** Parent FK column -> table, for checking a new node's parents belong to the same school. */
const PARENT_TABLES: Record<string, string> = {
  stage_id: 'qirtasi_education_stages',
  grade_id: 'qirtasi_grades',
  track_id: 'qirtasi_tracks',
  subject_id: 'qirtasi_subjects',
  unit_id: 'qirtasi_units',
  lesson_id: 'qirtasi_lessons',
};

const LEVELS: Record<CurriculumLevel, LevelConfig> = {
  stages: { table: 'qirtasi_education_stages', parentCol: null, hasCode: false },
  grades: { table: 'qirtasi_grades', parentCol: 'stage_id', hasCode: true },
  tracks: { table: 'qirtasi_tracks', parentCol: 'grade_id', hasCode: true },
  subjects: { table: 'qirtasi_subjects', parentCol: 'grade_id', hasCode: true },
  terms: { table: 'qirtasi_terms', parentCol: null, hasCode: false, shared: true },
  units: { table: 'qirtasi_units', parentCol: 'subject_id', hasCode: true },
  lessons: { table: 'qirtasi_lessons', parentCol: 'unit_id', hasCode: true },
  outcomes: { table: 'qirtasi_learning_outcomes', parentCol: 'lesson_id', hasCode: false },
};

export function getLevelConfig(level: string): LevelConfig | undefined {
  return LEVELS[level as CurriculumLevel];
}

export class CurriculumScopeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

class QirtasiCurriculumService {
  async list(level: CurriculumLevel, schoolId: string, parentId?: string): Promise<any[]> {
    const cfg = LEVELS[level];
    let query = supabase.from(cfg.table).select('*').order('sort_order', { ascending: true });
    if (!cfg.shared) query = query.eq('school_id', schoolId);
    if (parentId && cfg.parentCol) query = query.eq(cfg.parentCol, parentId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async get(level: CurriculumLevel, schoolId: string, id: string): Promise<any> {
    const cfg = LEVELS[level];
    let query = supabase.from(cfg.table).select('*').eq('id', id);
    if (!cfg.shared) query = query.eq('school_id', schoolId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) throw new CurriculumScopeError('Not found', 404);
    return data;
  }

  /** Every parent FK in the payload must point at a node of the same school (terms are shared). */
  private async assertParents(schoolId: string, payload: Record<string, any>) {
    for (const [col, table] of Object.entries(PARENT_TABLES)) {
      const value = payload[col];
      if (value === undefined || value === null) continue;
      const { data, error } = await supabase.from(table).select('id').eq('id', value).eq('school_id', schoolId).maybeSingle();
      if (error) throw error;
      if (!data) throw new CurriculumScopeError(`${col} not found`, 400);
    }
  }

  async create(level: CurriculumLevel, schoolId: string, payload: Record<string, any>): Promise<any> {
    const cfg = LEVELS[level];
    if (cfg.shared) throw new CurriculumScopeError('This level is shared and cannot be changed', 403);
    await this.assertParents(schoolId, payload);
    const { data, error } = await supabase.from(cfg.table).insert({ ...payload, school_id: schoolId }).select().single();
    if (error) throw error;
    return data;
  }

  async update(level: CurriculumLevel, schoolId: string, id: string, payload: Record<string, any>): Promise<any> {
    const cfg = LEVELS[level];
    if (cfg.shared) throw new CurriculumScopeError('This level is shared and cannot be changed', 403);
    const { data, error } = await supabase
      .from(cfg.table)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new CurriculumScopeError('Not found', 404);
    return data;
  }

  async remove(level: CurriculumLevel, schoolId: string, id: string): Promise<{ success: true }> {
    const cfg = LEVELS[level];
    if (cfg.shared) throw new CurriculumScopeError('This level is shared and cannot be changed', 403);
    const { data, error } = await supabase.from(cfg.table).delete().eq('id', id).eq('school_id', schoolId).select('id');
    if (error) throw error;
    if (!data?.length) throw new CurriculumScopeError('Not found', 404);
    return { success: true };
  }

  /**
   * The curriculum ids a worksheet is filed under must all belong to this school's tree
   * (term_id is shared). Throws a 400 CurriculumScopeError otherwise.
   */
  async assertWorksheetPlacement(schoolId: string, ids: { grade_id?: string | null; subject_id?: string | null; track_id?: string | null; unit_id?: string | null; lesson_id?: string | null }) {
    await this.assertParents(schoolId, ids);
  }
}

export const qirtasiCurriculumService = new QirtasiCurriculumService();
