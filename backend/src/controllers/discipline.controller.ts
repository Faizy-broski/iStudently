import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { getStudentDisciplineScore } from '../services/discipline-score.service';


const DEFAULT_DISCIPLINE_FIELDS = [
  {
    name: 'Email referral to',
    field_type: 'multiple_checkbox',
    options: [
      'Administrators',
      'Teachers',
    ],
    sort_order: 10,
  },
  {
    name: 'Violation',
    field_type: 'multiple_checkbox',
    options: [
      'Skipping Class',
      'Profanity, vulgarity, offensive language',
      'Insubordination (Refusal to Comply, Disrespectful Behavior)',
      'Inebriated (Alcohol or Drugs)',
      'Talking out of Turn',
      'Harassment',
      'Fighting',
      'Public Display of Affection',
      'Other',
    ],
    sort_order: 20,
  },
  {
    name: 'Detention Assigned',
    field_type: 'multiple_radio',
    options: [
      '10 Minutes',
      '20 Minutes',
      '30 Minutes',
      'Discuss Suspension',
    ],
    sort_order: 30,
  },
  {
    name: 'Suspensions (Office Only)',
    field_type: 'multiple_checkbox',
    options: [
      'Half Day',
      'In School Suspension',
      '1 Day',
      '2 Days',
      '3 Days',
      '5 Days',
      '7 Days',
      'Expulsion',
    ],
    sort_order: 40,
  },
  {
    name: 'Parents Contacted by Teacher',
    field_type: 'checkbox',
    options: null,
    sort_order: 50,
  },
  {
    name: 'Parent Contacted by Administrator',
    field_type: 'text',
    options: null,
    sort_order: 60,
  },
  {
    name: 'Comments',
    field_type: 'textarea',
    options: null,
    sort_order: 70,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSchoolId(req: Request): string | undefined {
  const body = (req as AuthRequest).body?.school_id;
  if (body) return body;
  const profile = (req as AuthRequest).profile;
  return profile?.school_id ?? undefined;
}

function resolveQuerySchoolId(req: Request): string | undefined {
  const q = (req.query.school_id as string) || undefined;
  if (q) return q;
  const profile = (req as AuthRequest).profile;
  return profile?.school_id ?? undefined;
}

// ---------------------------------------------------------------------------
// DISCIPLINE FIELDS (Setup / Referral Form)
// ---------------------------------------------------------------------------

/**
 * GET /api/discipline/fields
 * Query: school_id, include_inactive?
 */
export async function getFields(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req);
    if (!schoolId) {
      res.status(400).json({ error: 'school_id is required' });
      return;
    }

    const includeInactive = req.query.include_inactive === 'true';

    let query = supabase
      .from('discipline_fields')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // If there aren't any custom fields yet, or if a few of the defaults
    // were somehow removed/never created, insert whatever is missing.  This
    // allows rolling this change out to schools that already had a few fields
    // configured without stomping on their existing setup.
    if (schoolId) {
      const existingNames = (data || []).map((f: any) => f.name);
      const missingDefaults = DEFAULT_DISCIPLINE_FIELDS.filter(
        (f) => !existingNames.includes(f.name)
      );
      if (missingDefaults.length > 0) {
        const toInsert = missingDefaults.map((f) => ({
          ...f,
          school_id: schoolId,
        }));
        const { data: inserted, error: insertErr } = await supabase
          .from('discipline_fields')
          .insert(toInsert)
          .select();
        if (insertErr) {
          res.status(500).json({ error: insertErr.message });
          return;
        }
        // merge existing + inserted, sort by sort_order just like query did
        const combined = [...(data || []), ...(inserted || [])];
        combined.sort((a, b) => a.sort_order - b.sort_order);
        res.json({ data: combined });
        return;
      }
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/discipline/fields
 * Body: { school_id, name, field_type, options?, sort_order? }
 */
export async function createField(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveSchoolId(req);
    if (!schoolId) {
      res.status(400).json({ error: 'school_id is required' });
      return;
    }

    const { name, field_type, options, sort_order } = req.body;

    if (!name || !field_type) {
      res.status(400).json({ error: 'name and field_type are required' });
      return;
    }

    const { data, error } = await supabase
      .from('discipline_fields')
      .insert({
        school_id: schoolId,
        name,
        field_type,
        options: options || null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * PATCH /api/discipline/fields/:id
 * Body: { name?, field_type?, options?, sort_order?, is_active? }
 */
export async function updateField(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, field_type, options, sort_order, is_active } = req.body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (field_type !== undefined) updates.field_type = field_type;
    if (options !== undefined) updates.options = options;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('discipline_fields')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * DELETE /api/discipline/fields/:id
 */
export async function deleteField(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('discipline_fields')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// DISCIPLINE REFERRALS
// ---------------------------------------------------------------------------

/**
 * GET /api/discipline/referrals
 * Query: school_id, campus_id?, student_id?, start_date?, end_date?, academic_year_id?, page?, limit?
 */
export async function getReferrals(req: Request, res: Response): Promise<void> {
  try {
    let schoolId = resolveQuerySchoolId(req);
    // if caller passed a campus filter but we still don't know the school, try
    // to look it up from the campus record; this makes the endpoint usable when
    // only a campus (not a school) is supplied by a super‑admin context.
    const campusIdQ = req.query.campus_id as string | undefined;
    if (!schoolId && campusIdQ) {
      const { data: campus, error: capErr } = await supabase
        .from('campuses')
        .select('parent_school_id')
        .eq('id', campusIdQ)
        .single();
      if (campus && campus.parent_school_id) {
        schoolId = campus.parent_school_id;
      }
    }

    if (!schoolId) {
      res.status(400).json({ error: 'school_id is required' });
      return;
    }

    const {
      campus_id,
      student_id,
      start_date,
      end_date,
      academic_year_id,
      page = '1',
      limit = '50',
    } = req.query as Record<string, string>;

    const isReport = req.query.report === 'true';
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = isReport ? 5000 : Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = isReport ? 0 : (pageNum - 1) * limitNum;

    let query = supabase
      .from('discipline_referrals')
      .select(`
        *,
        students ( id, student_number, grade_level, section_id, profile:profiles(first_name, father_name, grandfather_name, last_name) ),
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('incident_date', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (campus_id) query = query.eq('campus_id', campus_id);
    if (student_id) query = query.eq('student_id', student_id);
    if (academic_year_id) query = query.eq('academic_year_id', academic_year_id);
    if (start_date) query = query.gte('incident_date', start_date);
    if (end_date) query = query.lte('incident_date', end_date);

    let { data, error, count } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // add full_name on the reporter object for frontend convenience
    if (data && Array.isArray(data)) {
      data = data.map((r: any) => {
        if (r.reporter && r.reporter.first_name !== undefined) {
          r.reporter.full_name = `${r.reporter.first_name || ''} ${r.reporter.last_name || ''}`.trim();
        }
        return r;
      });
    }

    res.json({ data, total: count ?? 0, page: pageNum, limit: limitNum });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * GET /api/discipline/referrals/:id
 */
export async function getReferralById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('discipline_referrals')
      .select(`
        *,
        students ( id, student_number, profile:profiles(first_name, father_name, grandfather_name, last_name) ),
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
      return;
    }

    if (data && data.reporter && data.reporter.first_name !== undefined) {
      data.reporter.full_name = `${data.reporter.first_name || ''} ${data.reporter.last_name || ''}`.trim();
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/discipline/referrals
 * Body: { school_id, campus_id?, student_id, reporter_id?, incident_date?, field_values?, academic_year_id? }
 */
export async function createReferral(req: Request, res: Response): Promise<void> {
  try {
    let schoolId = resolveSchoolId(req);
    // if we weren't able to determine a school from the profile/body, try the
    // campus supplied in the payload (common when a super‑admin posts)
    const { campus_id } = req.body;
    if (!schoolId && campus_id) {
      const { data: campus, error: capErr } = await supabase
        .from('campuses')
        .select('parent_school_id')
        .eq('id', campus_id)
        .single();
      if (campus && campus.parent_school_id) {
        schoolId = campus.parent_school_id;
      }
    }
    if (!schoolId) {
      res.status(400).json({ error: 'school_id is required' });
      return;
    }

    const {
      // campus_id,
      student_id,
      reporter_id,
      incident_date,
      field_values,
      academic_year_id,
    } = req.body;

    if (!student_id) {
      res.status(400).json({ error: 'student_id is required' });
      return;
    }

    const { data, error } = await supabase
      .from('discipline_referrals')
      .insert({
        school_id: schoolId,
        campus_id: campus_id || null,
        student_id,
        reporter_id: reporter_id || null,
        incident_date: incident_date || new Date().toISOString().slice(0, 10),
        field_values: field_values || {},
        academic_year_id: academic_year_id || null,
      })
      .select(`
        *,
        students ( id, student_number, profile:profiles(first_name, father_name, grandfather_name, last_name) ),
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // compute reporter full_name for client
    if (data && data.reporter && data.reporter.first_name !== undefined) {
      data.reporter.full_name = `${data.reporter.first_name || ''} ${data.reporter.last_name || ''}`.trim();
    }

    res.status(201).json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * PATCH /api/discipline/referrals/:id
 * Body: { campus_id?, reporter_id?, incident_date?, field_values?, academic_year_id? }
 */
export async function updateReferral(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { campus_id, reporter_id, incident_date, field_values, academic_year_id } = req.body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (campus_id !== undefined) updates.campus_id = campus_id;
    if (reporter_id !== undefined) updates.reporter_id = reporter_id;
    if (incident_date !== undefined) updates.incident_date = incident_date;
    if (field_values !== undefined) updates.field_values = field_values;
    if (academic_year_id !== undefined) updates.academic_year_id = academic_year_id;

    const { data, error } = await supabase
      .from('discipline_referrals')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        students ( id, student_number, profile:profiles(first_name, father_name, grandfather_name, last_name) ),
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (data && data.reporter && data.reporter.first_name !== undefined) {
      data.reporter.full_name = `${data.reporter.first_name || ''} ${data.reporter.last_name || ''}`.trim();
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// DISCIPLINE SCORE
// ---------------------------------------------------------------------------

/**
 * GET /api/discipline/score/:studentId
 * Query: campus_id?, academic_year_id?
 * school_id is resolved from the auth profile (or via campus lookup as fallback)
 */
export async function getStudentScore(req: Request, res: Response): Promise<void> {
  try {
    const { studentId } = req.params;
    const campusId = (req.query.campus_id as string) || null;
    const academicYearId = (req.query.academic_year_id as string) || null;

    // Resolve school_id from auth profile first; fall back to campus lookup
    let schoolId = resolveQuerySchoolId(req);
    if (!schoolId && campusId) {
      const { data: campus } = await supabase
        .from('campuses')
        .select('parent_school_id')
        .eq('id', campusId)
        .single();
      if (campus?.parent_school_id) schoolId = campus.parent_school_id;
    }
    if (!schoolId) {
      res.status(400).json({ error: 'school_id is required' });
      return;
    }

    const result = await getStudentDisciplineScore({ studentId, schoolId, campusId, academicYearId });
    res.json({ data: result });
  } catch (err: any) {
    if (err.message === 'PLUGIN_INACTIVE') {
      res.status(403).json({ error: 'PLUGIN_INACTIVE' });
      return;
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * DELETE /api/discipline/referrals/:id
 */
export async function deleteReferral(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('discipline_referrals')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// ZERO-TRUST ROLE ENDPOINTS (Teacher / Student / Parent)
// ---------------------------------------------------------------------------

export async function getStaffReferrals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req as Request);
    const staffId = req.profile?.staff_id;

    if (!schoolId || !staffId) {
      res.status(400).json({ error: 'school_id and staff context are required' });
      return;
    }

    const { data: rawData, error } = await supabase
      .from('discipline_referrals')
      .select(`
        *,
        students ( id, student_number, grade_level, section_id, profile:profiles(first_name, father_name, grandfather_name, last_name) ),
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `)
      .eq('school_id', schoolId)
      .eq('reporter_id', req.profile.id) // Only referrals written by this exact profile
      .order('incident_date', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    let data = rawData;
    if (data && Array.isArray(data)) {
      data = data.map((r: any) => {
        if (r.reporter && r.reporter.first_name !== undefined) {
          r.reporter.full_name = `${r.reporter.first_name || ''} ${r.reporter.last_name || ''}`.trim();
        }
        return r;
      });
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createStaffReferral(req: AuthRequest, res: Response): Promise<void> {
  try {
    const schoolId = resolveSchoolId(req as Request);
    if (!schoolId) {
      res.status(400).json({ error: 'school_id is required' });
      return;
    }

    const { student_id, field_values, incident_date } = req.body;
    
    // Zero-Trust: We ignore incoming reporter_id completely and lock it to the active session.
    const reporterId = req.profile?.id;

    if (!student_id || !reporterId) {
      res.status(400).json({ error: 'student_id and valid staff profile are required' });
      return;
    }

    const { data, error } = await supabase
      .from('discipline_referrals')
      .insert({
        school_id: schoolId,
        student_id,
        reporter_id: reporterId, // strictly enforced
        incident_date: incident_date || new Date().toISOString().slice(0, 10),
        field_values: field_values || {}
      })
      .select(`
        *,
        students ( id, student_number, profile:profiles(first_name, father_name, grandfather_name, last_name) ),
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (data && data.reporter && data.reporter.first_name !== undefined) {
      data.reporter.full_name = `${data.reporter.first_name || ''} ${data.reporter.last_name || ''}`.trim();
    }

    res.status(201).json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getStudentReferrals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const studentId = req.profile?.student_id;
    if (!studentId) {
      res.status(400).json({ error: 'Valid student context required' });
      return;
    }

    const { data: rawData, error } = await supabase
      .from('discipline_referrals')
      .select(`
        *,
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `)
      .eq('student_id', studentId) // strictly scoped
      .order('incident_date', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    let data = rawData;
    if (data && Array.isArray(data)) {
      data = data.map((r: any) => {
        if (r.reporter && r.reporter.first_name !== undefined) {
          r.reporter.full_name = `${r.reporter.first_name || ''} ${r.reporter.last_name || ''}`.trim();
        }
        return r;
      });
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getParentReferrals(req: AuthRequest, res: Response): Promise<void> {
  try {
    const parentProfileId = req.profile?.id;
    if (!parentProfileId) {
      res.status(400).json({ error: 'Valid parent context required' });
      return;
    }

    // 1. Fetch dependent student IDs securely
    const { data: rels } = await supabase
      .from('parent_student_associations')
      .select('student_id')
      .eq('parent_id', parentProfileId);

    const studentIds = rels?.map(r => r.student_id) || [];
    if (studentIds.length === 0) {
      res.json({ data: [] });
      return;
    }

    // 2. Query referrals but only IN the dependent student IDs securely
    const { data: rawData, error } = await supabase
      .from('discipline_referrals')
      .select(`
        *,
        students ( id, student_number, profile:profiles(first_name, grandfather_name, last_name) ),
        reporter:profiles!discipline_referrals_reporter_id_fkey ( id, first_name, last_name )
      `)
      .in('student_id', studentIds)
      .order('incident_date', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    let data = rawData;
    if (data && Array.isArray(data)) {
      data = data.map((r: any) => {
        if (r.reporter && r.reporter.first_name !== undefined) {
          r.reporter.full_name = `${r.reporter.first_name || ''} ${r.reporter.last_name || ''}`.trim();
        }
        return r;
      });
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

