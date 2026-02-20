import { Request, Response } from 'express';
import supabase from '../config/supabase';
import type {
  StudentEnrollment,
  CreateEnrollmentRequest,
  UpdateEnrollmentRequest,
  SetStudentRolloverStatusRequest,
  BulkSetRolloverStatusRequest,
  EnrollmentStatistics,
  CurrentEnrollmentInfo,
  GradeProgressionItem,
} from '../types/enrollment.types';

/**
 * Get current enrollment for a student
 * GET /api/enrollment/student/:id/current
 */
export async function getCurrentEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const { id: studentId } = req.params;

    // Call the helper function
    const { data, error } = await supabase.rpc('get_student_current_enrollment', {
      p_student_id: studentId,
    });

    if (error) {
      console.error('Get current enrollment error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data || data.length === 0) {
      res.status(404).json({ error: 'No current enrollment found' });
      return;
    }

    res.json(data[0] as CurrentEnrollmentInfo);
  } catch (error: any) {
    console.error('Get current enrollment exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Get enrollment history for a student
 * GET /api/enrollment/student/:id/history
 */
export async function getEnrollmentHistory(req: Request, res: Response): Promise<void> {
  try {
    const { id: studentId } = req.params;
    const { include_current } = req.query;

    let query = supabase
      .from('student_enrollment')
      .select(`
        *,
        academic_year:academic_years!inner(id, name, start_date, end_date, is_current),
        grade_level:grade_levels(id, name, order_index),
        section:sections(id, name),
        enrollment_code:enrollment_codes(id, code, title)
      `)
      .eq('student_id', studentId)
      .order('start_date', { ascending: false });

    if (include_current !== 'true') {
      query = query.not('end_date', 'is', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get enrollment history error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data as StudentEnrollment[]);
  } catch (error: any) {
    console.error('Get enrollment history exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Create new enrollment record
 * POST /api/enrollment
 */
export async function createEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const enrollmentData = req.body as CreateEnrollmentRequest;

    // Get enrollment code ID from code
    const { data: codeData, error: codeError } = await supabase
      .from('enrollment_codes')
      .select('id')
      .eq('code', enrollmentData.enrollment_code)
      .single();

    if (codeError) {
      res.status(400).json({ error: 'Invalid enrollment code' });
      return;
    }

    const { data, error } = await supabase
      .from('student_enrollment')
      .insert({
        student_id: enrollmentData.student_id,
        academic_year_id: enrollmentData.academic_year_id,
        school_id: enrollmentData.school_id,
        grade_level_id: enrollmentData.grade_level_id,
        section_id: enrollmentData.section_id,
        enrollment_code_id: codeData.id,
        start_date: enrollmentData.start_date,
        next_grade_id: enrollmentData.next_grade_id,
        rollover_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Create enrollment error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data as StudentEnrollment);
  } catch (error: any) {
    console.error('Create enrollment exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Update enrollment record
 * PATCH /api/enrollment/:id
 */
export async function updateEnrollment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateEnrollmentRequest;

    const { data, error } = await supabase
      .from('student_enrollment')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update enrollment error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data as StudentEnrollment);
  } catch (error: any) {
    console.error('Update enrollment exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Set student rollover status
 * PATCH /api/enrollment/student/:id/rollover-status
 */
export async function setRolloverStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id: studentId } = req.params;
    const { academic_year_id, rollover_status, next_grade_id, notes } = req.body as SetStudentRolloverStatusRequest;

    const { data, error } = await supabase
      .from('student_enrollment')
      .update({
        rollover_status,
        next_grade_id,
        rollover_notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('academic_year_id', academic_year_id)
      .is('end_date', null)
      .select()
      .single();

    if (error) {
      console.error('Set rollover status error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data as StudentEnrollment);
  } catch (error: any) {
    console.error('Set rollover status exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Bulk set rollover status for multiple students
 * PATCH /api/enrollment/bulk-rollover-status
 */
export async function bulkSetRolloverStatus(req: Request, res: Response): Promise<void> {
  try {
    const { academic_year_id, school_id, filters, rollover_status, next_grade_id } = req.body as BulkSetRolloverStatusRequest;

    let query = supabase
      .from('student_enrollment')
      .update({
        rollover_status,
        next_grade_id,
        updated_at: new Date().toISOString(),
      })
      .eq('academic_year_id', academic_year_id)
      .eq('school_id', school_id)
      .is('end_date', null);

    // Apply filters
    if (filters?.grade_level_id) {
      query = query.eq('grade_level_id', filters.grade_level_id);
    }

    if (filters?.section_id) {
      query = query.eq('section_id', filters.section_id);
    }

    if (filters?.student_ids && filters.student_ids.length > 0) {
      query = query.in('student_id', filters.student_ids);
    }

    const { data, error, count } = await query.select('id', { count: 'exact' });

    if (error) {
      console.error('Bulk set rollover status error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ updated_count: count || 0 });
  } catch (error: any) {
    console.error('Bulk set rollover status exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Get enrollment statistics
 * GET /api/enrollment/statistics
 */
export async function getStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { academic_year_id, school_id } = req.query;

    if (!academic_year_id || !school_id) {
      res.status(400).json({ error: 'Missing academic_year_id or school_id' });
      return;
    }

    // Get total students
    const { count: totalCount } = await supabase
      .from('student_enrollment')
      .select('*', { count: 'exact', head: true })
      .eq('academic_year_id', academic_year_id as string)
      .eq('school_id', school_id as string)
      .is('end_date', null);

    // Get by grade
    const { data: byGrade } = await supabase
      .from('student_enrollment')
      .select(`
        grade_level_id,
        grade_level:grade_levels(id, name, order_index)
      `)
      .eq('academic_year_id', academic_year_id as string)
      .eq('school_id', school_id as string)
      .is('end_date', null);

    // Get by enrollment code
    const { data: byCode } = await supabase
      .from('student_enrollment')
      .select(`
        enrollment_code_id,
        enrollment_code:enrollment_codes(code, title)
      `)
      .eq('academic_year_id', academic_year_id as string)
      .eq('school_id', school_id as string)
      .is('end_date', null);

    // Get by rollover status
    const { data: byStatus } = await supabase
      .from('student_enrollment')
      .select('rollover_status')
      .eq('academic_year_id', academic_year_id as string)
      .eq('school_id', school_id as string)
      .is('end_date', null);

    // Aggregate statistics
    const gradeStats = byGrade?.reduce((acc: any[], item: any) => {
      const existing = acc.find(g => g.grade_id === item.grade_level_id);
      if (existing) {
        existing.count++;
      } else {
        acc.push({
          grade_id: item.grade_level_id,
          grade_name: item.grade_level?.name || 'Unknown',
          count: 1,
        });
      }
      return acc;
    }, []) || [];

    const codeStats = byCode?.reduce((acc: any[], item: any) => {
      const code = item.enrollment_code?.code || 'UNKNOWN';
      const existing = acc.find(c => c.code === code);
      if (existing) {
        existing.count++;
      } else {
        acc.push({
          code,
          code_title: item.enrollment_code?.title || 'Unknown',
          count: 1,
        });
      }
      return acc;
    }, []) || [];

    const statusStats = byStatus?.reduce((acc: Record<string, number>, item: any) => {
      const status = item.rollover_status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}) || {};

    const statistics: EnrollmentStatistics = {
      school_id: school_id as string,
      academic_year_id: academic_year_id as string,
      total_students: totalCount || 0,
      by_grade: gradeStats,
      by_enrollment_code: codeStats,
      by_rollover_status: statusStats,
    };

    res.json(statistics);
  } catch (error: any) {
    console.error('Get statistics exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Get students by rollover status
 * GET /api/enrollment/by-status
 */
export async function getStudentsByStatus(req: Request, res: Response): Promise<void> {
  try {
    const { academic_year_id, school_id, status } = req.query;

    if (!academic_year_id || !school_id) {
      res.status(400).json({ error: 'Missing academic_year_id or school_id' });
      return;
    }

    let query = supabase
      .from('student_enrollment')
      .select(`
        student_id,
        rollover_status,
        student:students!inner(id, student_number),
        grade_level:grade_levels(name),
        section:sections(name)
      `)
      .eq('academic_year_id', academic_year_id as string)
      .eq('school_id', school_id as string)
      .is('end_date', null);

    if (status) {
      query = query.eq('rollover_status', status as string);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get students by status error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Transform data
    const students = data?.map((item: any) => ({
      student_id: item.student_id,
      student_number: item.student?.student_number,
      grade_name: item.grade_level?.name || 'Unassigned',
      section_name: item.section?.name || 'Unassigned',
      rollover_status: item.rollover_status,
    })) || [];

    res.json(students);
  } catch (error: any) {
    console.error('Get students by status exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Get grade progression chain
 * GET /api/grades/progression
 */
export async function getGradeProgression(req: Request, res: Response): Promise<void> {
  try {
    const { school_id } = req.query;

    if (!school_id) {
      res.status(400).json({ error: 'Missing school_id' });
      return;
    }

    const { data, error } = await supabase
      .from('grade_levels')
      .select(`
        id,
        name,
        order_index,
        next_grade_id,
        next_grade:grade_levels!grade_levels_next_grade_id_fkey(id, name)
      `)
      .eq('school_id', school_id as string)
      .eq('is_active', true)
      .order('order_index');

    if (error) {
      console.error('Get grade progression error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    const progression: GradeProgressionItem[] = data?.map((grade: any) => ({
      id: grade.id,
      name: grade.name,
      order_index: grade.order_index,
      next_grade_id: grade.next_grade_id,
      next_grade_name: grade.next_grade?.name || null,
      is_terminal: !grade.next_grade_id,
    })) || [];

    res.json(progression);
  } catch (error: any) {
    console.error('Get grade progression exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
