import { supabase } from '../../config/supabase';
import { isCampus, getAllCampusIds } from '../../utils/school-helpers';

export const QIRTASI_WORKSHEET_BUCKET = 'worksheet-library'; // reused as-is from the superseded slice
const SIGNED_URL_TTL_SECONDS = 300;

export interface QirtasiWorksheet {
  id: string;
  code: string;
  title_ar: string;
  title_en: string | null;
  description: string | null;
  worksheet_type: string;
  owner_id: string | null;
  school_id: string | null;
  grade_id: string;
  subject_id: string;
  track_id: string | null;
  term_id: string | null;
  unit_id: string | null;
  lesson_id: string | null;
  visibility_scope: 'private' | 'school' | 'marketplace' | 'public';
  license_type: string;
  price_lyd: number | null;
  status: string;
  moderation_status: string;
  quality_score: number;
  current_version_id: string | null;
  is_generated: boolean;
  source_worksheet_id: string | null;
  download_count: number;
  rating_avg: number;
  created_at: string;
  updated_at: string;
}

export interface WorksheetListFilters {
  grade_id?: string;
  subject_id?: string;
  track_id?: string;
  term_id?: string;
  unit_id?: string;
  lesson_id?: string;
  worksheet_type?: string;
  facet_value_ids?: string[];
  search?: string;
  campus_id?: string;
  limit?: number;
  offset?: number;
}

interface AssetInput {
  storage_key: string;
  mime_type: string;
  file_size: number;
  asset_role: string;
}

function buildCode(gradeCode: string, subjectCode: string, termKey: string | null, unitCode: string | null, lessonCode: string | null, seq: number): string {
  // QRT-LY-<grade>-<subject>-<term>-<unit>-<lesson>-EX<seq> — see spec §6.5.
  // "LY" is hardcoded: this is explicitly a Libyan-market product per the spec.
  const parts = ['QRT', 'LY', gradeCode, subjectCode];
  if (termKey) parts.push(termKey);
  if (unitCode) parts.push(unitCode);
  if (lessonCode) parts.push(lessonCode);
  parts.push(`EX${String(seq).padStart(2, '0')}`);
  return parts.join('-');
}

class QirtasiWorksheetsService {
  private async resolveSchoolIds(schoolId: string, userRole?: string, campusId?: string): Promise<string[]> {
    if (campusId) return [campusId];
    const isParentSchool = !(await isCampus(schoolId));
    if (userRole === 'admin' && isParentSchool) {
      return getAllCampusIds(schoolId);
    }
    return [schoolId];
  }

  async listWorksheets(
    schoolId: string,
    userRole: string | undefined,
    filters: WorksheetListFilters = {}
  ): Promise<{ data: QirtasiWorksheet[]; count: number }> {
    const schoolIds = await this.resolveSchoolIds(schoolId, userRole, filters.campus_id);
    const limit = filters.limit ?? 24;
    const offset = filters.offset ?? 0;

    // Visible: this school's own content, OR platform-wide public content
    // (school_id IS NULL with visibility_scope='public'). Marketplace is
    // excluded — no payment system exists yet (see the plan's entitlements
    // decision).
    let query = supabase
      .from('qirtasi_worksheets')
      .select('*', { count: 'exact' })
      .eq('status', 'published')
      .or(`school_id.in.(${schoolIds.join(',')}),and(school_id.is.null,visibility_scope.eq.public)`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.grade_id) query = query.eq('grade_id', filters.grade_id);
    if (filters.subject_id) query = query.eq('subject_id', filters.subject_id);
    if (filters.track_id) query = query.eq('track_id', filters.track_id);
    if (filters.term_id) query = query.eq('term_id', filters.term_id);
    if (filters.unit_id) query = query.eq('unit_id', filters.unit_id);
    if (filters.lesson_id) query = query.eq('lesson_id', filters.lesson_id);
    if (filters.worksheet_type) query = query.eq('worksheet_type', filters.worksheet_type);
    if (filters.search) query = query.or(`title_ar.ilike.%${filters.search}%,title_en.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

    // Facet filtering: worksheets matching ANY of the requested facet values
    // (a simplification for this foundation slice — the spec's full model
    // is AND-across-facets / OR-within-a-facet, which needs grouping
    // requested values by their parent facet first; deferred).
    if (filters.facet_value_ids?.length) {
      const { data: matches } = await supabase
        .from('qirtasi_worksheet_facet_values')
        .select('worksheet_id')
        .in('facet_value_id', filters.facet_value_ids);
      const ids = [...new Set((matches ?? []).map((m: any) => m.worksheet_id))];
      if (ids.length === 0) return { data: [], count: 0 };
      query = query.in('id', ids);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data ?? []) as QirtasiWorksheet[], count: count ?? 0 };
  }

  async getWorksheetById(id: string): Promise<any> {
    const { data: worksheet, error } = await supabase.from('qirtasi_worksheets').select('*').eq('id', id).single();
    if (error) throw error;

    const { data: assets } = worksheet.current_version_id
      ? await supabase.from('qirtasi_worksheet_assets').select('*').eq('version_id', worksheet.current_version_id)
      : { data: [] };

    const { data: facetValues } = await supabase
      .from('qirtasi_worksheet_facet_values')
      .select('facet_value_id, assigned_by, confidence, qirtasi_facet_values(id, value_key, label_ar, label_en, facet_id)')
      .eq('worksheet_id', id);

    return { ...worksheet, assets: assets ?? [], facet_values: facetValues ?? [] };
  }

  private async nextSequenceForLesson(lessonId: string | null): Promise<number> {
    if (!lessonId) return 1;
    const { count } = await supabase
      .from('qirtasi_worksheets')
      .select('*', { count: 'exact', head: true })
      .eq('lesson_id', lessonId);
    return (count ?? 0) + 1;
  }

  async createWorksheet(
    input: {
      title_ar: string;
      title_en?: string;
      description?: string;
      worksheet_type: string;
      grade_id: string;
      subject_id: string;
      track_id?: string | null;
      term_id?: string | null;
      unit_id?: string | null;
      lesson_id?: string | null;
      visibility_scope?: 'private' | 'school' | 'public';
      facet_value_ids?: string[];
    },
    schoolId: string,
    ownerId: string | null,
    assets: AssetInput[]
  ): Promise<QirtasiWorksheet> {
    const { data: grade } = await supabase.from('qirtasi_grades').select('code').eq('id', input.grade_id).single();
    const { data: subject } = await supabase.from('qirtasi_subjects').select('code').eq('id', input.subject_id).single();
    const term = input.term_id ? (await supabase.from('qirtasi_terms').select('key').eq('id', input.term_id).single()).data : null;
    const unit = input.unit_id ? (await supabase.from('qirtasi_units').select('code').eq('id', input.unit_id).single()).data : null;
    const lesson = input.lesson_id ? (await supabase.from('qirtasi_lessons').select('code').eq('id', input.lesson_id).single()).data : null;

    const seq = await this.nextSequenceForLesson(input.lesson_id ?? null);
    const code = buildCode(grade?.code ?? 'XX', subject?.code ?? 'XX', term?.key ?? null, unit?.code ?? null, lesson?.code ?? null, seq);

    const { data: worksheet, error } = await supabase
      .from('qirtasi_worksheets')
      .insert({
        code,
        title_ar: input.title_ar,
        title_en: input.title_en ?? null,
        description: input.description ?? null,
        worksheet_type: input.worksheet_type,
        owner_id: ownerId,
        school_id: schoolId,
        grade_id: input.grade_id,
        subject_id: input.subject_id,
        track_id: input.track_id ?? null,
        term_id: input.term_id ?? null,
        unit_id: input.unit_id ?? null,
        lesson_id: input.lesson_id ?? null,
        visibility_scope: input.visibility_scope ?? 'school',
        status: 'published', // no moderation queue UI yet — see the plan's deferred list
      })
      .select()
      .single();
    if (error) throw error;

    const { data: version, error: versionErr } = await supabase
      .from('qirtasi_worksheet_versions')
      .insert({ worksheet_id: worksheet.id, version_number: 1, created_by: ownerId })
      .select()
      .single();
    if (versionErr) throw versionErr;

    if (assets.length > 0) {
      const { error: assetsErr } = await supabase.from('qirtasi_worksheet_assets').insert(
        assets.map((a) => ({ version_id: version.id, asset_role: a.asset_role, storage_key: a.storage_key, mime_type: a.mime_type, file_size: a.file_size }))
      );
      if (assetsErr) throw assetsErr;
    }

    await supabase.from('qirtasi_worksheets').update({ current_version_id: version.id }).eq('id', worksheet.id);

    if (input.facet_value_ids?.length) {
      await supabase.from('qirtasi_worksheet_facet_values').insert(
        input.facet_value_ids.map((fvId) => ({ worksheet_id: worksheet.id, facet_value_id: fvId, assigned_by: 'user' }))
      );
    }

    return { ...worksheet, current_version_id: version.id };
  }

  async updateWorksheet(
    id: string,
    input: Partial<Pick<QirtasiWorksheet, 'title_ar' | 'title_en' | 'description' | 'worksheet_type' | 'grade_id' | 'subject_id' | 'track_id' | 'term_id' | 'unit_id' | 'lesson_id' | 'visibility_scope' | 'status'>> & { facet_value_ids?: string[] }
  ): Promise<QirtasiWorksheet> {
    const { facet_value_ids, ...fields } = input;
    const { data, error } = await supabase
      .from('qirtasi_worksheets')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (facet_value_ids) {
      await supabase.from('qirtasi_worksheet_facet_values').delete().eq('worksheet_id', id);
      if (facet_value_ids.length > 0) {
        await supabase.from('qirtasi_worksheet_facet_values').insert(
          facet_value_ids.map((fvId) => ({ worksheet_id: id, facet_value_id: fvId, assigned_by: 'user' }))
        );
      }
    }

    return data as QirtasiWorksheet;
  }

  /** Deletes the worksheet row (versions/assets/facet-values cascade via FK)
   * and returns the asset storage keys so the caller can clean up storage. */
  async deleteWorksheet(id: string): Promise<string[]> {
    const { data: worksheet } = await supabase.from('qirtasi_worksheets').select('current_version_id').eq('id', id).single();
    const { data: assets } = worksheet?.current_version_id
      ? await supabase.from('qirtasi_worksheet_assets').select('storage_key').eq('version_id', worksheet.current_version_id)
      : { data: [] };

    const { error } = await supabase.from('qirtasi_worksheets').delete().eq('id', id);
    if (error) throw error;

    return (assets ?? []).map((a: any) => a.storage_key);
  }

  async mintAssetUrl(worksheetId: string, role: string): Promise<{ url: string; title: string } | null> {
    const worksheet = await this.getWorksheetById(worksheetId);
    const asset = (worksheet.assets ?? []).find((a: any) => a.asset_role === role);
    if (!asset) return null;

    const { data, error } = await supabase.storage.from(QIRTASI_WORKSHEET_BUCKET).createSignedUrl(asset.storage_key, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return null;

    if (role === 'primary') {
      const { error: rpcError } = await supabase.rpc('increment_qirtasi_worksheet_downloads', { p_worksheet_id: worksheetId });
      if (rpcError) console.error('increment_qirtasi_worksheet_downloads failed:', rpcError);
    }

    return { url: data.signedUrl, title: worksheet.title_ar };
  }
}

export const qirtasiWorksheetsService = new QirtasiWorksheetsService();
