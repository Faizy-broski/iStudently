import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import type { AuthRequest } from '../middlewares/auth.middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Fetch students with profile names by IDs (avoids FK ambiguity in junction tables)
async function fetchStudentsById(ids: string[]): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, father_name, grandfather_name, last_name)')
    .in('id', ids);

  // flatten the profile fields so consumers don't need to drill in every time
  return Object.fromEntries(
    (data || []).map((s: any) => {
      const prof = s.profile || {};
      const flattened = {
        ...s,
        first_name: prof.first_name,
        last_name: prof.last_name,
        father_name: prof.father_name,
        grandfather_name: prof.grandfather_name,
      };
      return [s.id, flattened];
    })
  );
}

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
// ACTIVITIES (Setup)
// ---------------------------------------------------------------------------

/**
 * GET /api/activities
 * Query: school_id, campus_id?, academic_year_id?, include_inactive?
 */
export async function getActivities(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { campus_id, academic_year_id } = req.query as Record<string, string>;
    const includeInactive = req.query.include_inactive === 'true';

    let query = supabase
      .from('activities')
      .select('*')
      .eq('school_id', schoolId)
      .order('title', { ascending: true });

    if (!includeInactive) query = query.eq('is_active', true);
    if (campus_id) query = query.eq('campus_id', campus_id);
    if (academic_year_id) query = query.eq('academic_year_id', academic_year_id);

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/activities
 * Body: { school_id, campus_id?, academic_year_id?, title, start_date?, end_date?, comment? }
 */
export async function createActivity(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveSchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { campus_id, academic_year_id, title, start_date, end_date, comment } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        school_id: schoolId,
        campus_id: campus_id || null,
        academic_year_id: academic_year_id || null,
        title,
        start_date: start_date || null,
        end_date: end_date || null,
        comment: comment || null,
      })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * PATCH /api/activities/:id
 * Body: { title?, start_date?, end_date?, comment?, is_active? }
 */
export async function updateActivity(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title, start_date, end_date, comment, is_active } = req.body;

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (comment !== undefined) updates.comment = comment;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('activities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * DELETE /api/activities/:id
 */
export async function deleteActivity(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// STUDENT ENROLLMENT
// ---------------------------------------------------------------------------

/**
 * GET /api/activities/:id/students
 * Returns enrolled students for an activity
 */
export async function getActivityStudents(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Step 1: get enrollment rows (no students join to avoid FK ambiguity)
    const { data: rows, error } = await supabase
      .from('student_activities')
      .select('id, student_id, created_at')
      .eq('activity_id', id)
      .order('created_at', { ascending: true });

    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!rows || rows.length === 0) { res.json({ data: [] }); return; }

    // Step 2: fetch students with profile names
    const studentIds = rows.map((r: any) => r.student_id);
    const studentMap = await fetchStudentsById(studentIds);

    const data = rows.map((r: any) => ({ ...r, students: studentMap[r.student_id] || null }));
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/activities/:id/students
 * Body: { student_ids: string[], school_id, campus_id?, academic_year_id? }
 * Bulk-enroll students; silently skips duplicates.
 */
export async function enrollStudents(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { student_ids, school_id, campus_id, academic_year_id } = req.body;

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      res.status(400).json({ error: 'student_ids array is required' });
      return;
    }

    const rows = student_ids.map((sid: string) => ({
      student_id: sid,
      activity_id: id,
      school_id: school_id || resolveSchoolId(req),
      campus_id: campus_id || null,
      academic_year_id: academic_year_id || null,
    }));

    const { data, error } = await supabase
      .from('student_activities')
      .upsert(rows, { onConflict: 'student_id,activity_id', ignoreDuplicates: true })
      .select();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(201).json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * DELETE /api/activities/:id/students/:studentId
 */
export async function unenrollStudent(req: Request, res: Response): Promise<void> {
  try {
    const { id, studentId } = req.params;

    const { error } = await supabase
      .from('student_activities')
      .delete()
      .eq('activity_id', id)
      .eq('student_id', studentId);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// ELIGIBILITY
// ---------------------------------------------------------------------------

/**
 * GET /api/activities/eligibility
 * Query: school_id, course_period_id, school_date, campus_id?
 * Returns all eligibility records for that course period + date.
 */
export async function getEligibility(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { course_period_id, school_date, campus_id } = req.query as Record<string, string>;
    if (!course_period_id || !school_date) {
      res.status(400).json({ error: 'course_period_id and school_date are required' });
      return;
    }

    // Step 1: get eligibility rows (no students join)
    let query = supabase
      .from('student_eligibility')
      .select('*')
      .eq('school_id', schoolId)
      .eq('course_period_id', course_period_id)
      .eq('school_date', school_date);

    if (campus_id) query = query.eq('campus_id', campus_id);

    const { data: rows, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!rows || rows.length === 0) { res.json({ data: [] }); return; }

    // Step 2: fetch students with profile names
    const studentIds = rows.map((r: any) => r.student_id);
    const studentMap = await fetchStudentsById(studentIds);
    const data = rows.map((r: any) => ({ ...r, students: studentMap[r.student_id] || null }));

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/activities/eligibility
 * Body: { school_id, campus_id?, academic_year_id?, course_period_id, school_date,
 *         records: [{ student_id, eligibility_code }], reported_by? }
 * Upserts eligibility records and marks the course period as completed.
 */
export async function saveEligibility(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveSchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { campus_id, academic_year_id, course_period_id, school_date, records, reported_by } = req.body;

    if (!course_period_id || !school_date || !Array.isArray(records)) {
      res.status(400).json({ error: 'course_period_id, school_date, and records are required' });
      return;
    }

    const profile = (req as AuthRequest).profile;
    const reporterId = reported_by || profile?.id || null;

    const rows = records.map((r: { student_id: string; eligibility_code: string }) => ({
      student_id: r.student_id,
      course_period_id,
      school_date,
      eligibility_code: r.eligibility_code || 'PASSING',
      school_id: schoolId,
      campus_id: campus_id || null,
      academic_year_id: academic_year_id || null,
      reported_by: reporterId,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('student_eligibility')
      .upsert(rows, { onConflict: 'student_id,course_period_id,school_date' })
      .select();

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Mark course period as completed for this date
    await supabase
      .from('eligibility_completed')
      .upsert({
        staff_id: reporterId,
        course_period_id,
        school_date,
        school_id: schoolId,
        campus_id: campus_id || null,
      }, { onConflict: 'course_period_id,school_date,school_id' });

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * GET /api/activities/eligibility/student
 * Query: school_id, student_id, academic_year_id?
 * Returns all eligibility records for a student (for the Student Screen).
 */
export async function getStudentEligibility(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { student_id, academic_year_id } = req.query as Record<string, string>;
    if (!student_id) { res.status(400).json({ error: 'student_id is required' }); return; }

    let query = supabase
      .from('student_eligibility')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', student_id)
      .order('school_date', { ascending: false });

    if (academic_year_id) query = query.eq('academic_year_id', academic_year_id);

    const { data, error } = await query;
    if (error) { res.status(500).json({ error: error.message }); return; }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// ENTRY TIMES (Settings)
// ---------------------------------------------------------------------------

/**
 * GET /api/activities/settings/entry-times
 * Query: school_id
 */
export async function getEntryTimes(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { data, error } = await supabase
      .from('eligibility_settings')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle();

    if (error) { res.status(500).json({ error: error.message }); return; }

    // Return defaults if no record exists yet
    res.json({
      data: data ?? {
        school_id: schoolId,
        start_day: 0,
        start_hour: 8,
        start_minute: 0,
        end_day: 4,
        end_hour: 17,
        end_minute: 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * POST /api/activities/settings/entry-times
 * Body: { school_id, start_day, start_hour, start_minute, end_day, end_hour, end_minute }
 */
export async function saveEntryTimes(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveSchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { start_day, start_hour, start_minute, end_day, end_hour, end_minute } = req.body;

    const { data, error } = await supabase
      .from('eligibility_settings')
      .upsert({
        school_id: schoolId,
        start_day: start_day ?? 0,
        start_hour: start_hour ?? 8,
        start_minute: start_minute ?? 0,
        end_day: end_day ?? 4,
        end_hour: end_hour ?? 17,
        end_minute: end_minute ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'school_id' })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// REPORTS
// ---------------------------------------------------------------------------

/**
 * GET /api/activities/reports/student-list
 * Query: school_id, activity_id, campus_id?, academic_year_id?
 * Returns students enrolled in the activity with their latest eligibility summary.
 */
export async function getStudentListReport(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { activity_id, campus_id, academic_year_id } = req.query as Record<string, string>;
    if (!activity_id) { res.status(400).json({ error: 'activity_id is required' }); return; }

    // Get enrolled students
    // Step 1: get enrollment rows (no students join)
    let enrollQuery = supabase
      .from('student_activities')
      .select('student_id')
      .eq('activity_id', activity_id)
      .eq('school_id', schoolId);

    if (campus_id) enrollQuery = enrollQuery.eq('campus_id', campus_id);

    const { data: enrolled, error: enrollErr } = await enrollQuery;
    if (enrollErr) { res.status(500).json({ error: enrollErr.message }); return; }

    if (!enrolled || enrolled.length === 0) {
      res.json({ data: [] });
      return;
    }

    const studentIds = enrolled.map((e: any) => e.student_id);

    // Get most recent eligibility for each student
    let eligQuery = supabase
      .from('student_eligibility')
      .select('student_id, eligibility_code, school_date, course_period_id')
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .order('school_date', { ascending: false });

    if (academic_year_id) eligQuery = eligQuery.eq('academic_year_id', academic_year_id);

    const { data: eligibility, error: eligErr } = await eligQuery;
    if (eligErr) { res.status(500).json({ error: eligErr.message }); return; }

    // Build per-student eligibility summary
    const eligMap: Record<string, any[]> = {};
    for (const e of (eligibility || [])) {
      if (!eligMap[e.student_id]) eligMap[e.student_id] = [];
      eligMap[e.student_id].push(e);
    }

    // (enrolled rows only contained student_id) fetch names for display
    const studentMap = await fetchStudentsById(studentIds);

    const result = enrolled.map((e: any) => ({
      student: studentMap[e.student_id] || null,
      eligibility_records: eligMap[e.student_id] || [],
    }));

    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * GET /api/activities/reports/teacher-completion
 * Query: school_id, school_date, campus_id?
 * Returns completion status per course period for the given date.
 */
export async function getTeacherCompletionReport(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = resolveQuerySchoolId(req);
    if (!schoolId) { res.status(400).json({ error: 'school_id is required' }); return; }

    const { school_date, campus_id } = req.query as Record<string, string>;
    if (!school_date) { res.status(400).json({ error: 'school_date is required' }); return; }

    // Get completed entries
    let completedQuery = supabase
      .from('eligibility_completed')
      .select(`
        course_period_id,
        school_date,
        staff_id,
        staff:profiles!eligibility_completed_staff_id_fkey ( id, first_name, last_name )
      `)
      .eq('school_id', schoolId)
      .eq('school_date', school_date);

    if (campus_id) completedQuery = completedQuery.eq('campus_id', campus_id);

    const { data: completed, error: compErr } = await completedQuery;
    if (compErr) { res.status(500).json({ error: compErr.message }); return; }

    // ensure frontend can rely on a single full_name field
    const transformed = (completed || []).map((c: any) => {
      if (c.staff && c.staff.first_name !== undefined) {
        c.staff.full_name = `${c.staff.first_name || ''} ${c.staff.last_name || ''}`.trim();
      }
      return c;
    });
    res.json({ data: transformed });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
