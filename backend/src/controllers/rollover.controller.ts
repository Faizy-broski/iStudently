import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import type {
  RolloverPreview,
  RolloverRequest,
  RolloverResult,
  RolloverPrerequisiteCheck,
} from '../types/enrollment.types';
import type { AuthRequest } from '../middlewares/auth.middleware';

/** Resolve school_id: prefer body, fall back to authenticated profile */
function resolveSchoolId(req: Request): string | undefined {
  const body = (req as AuthRequest).body?.school_id;
  if (body) return body;
  const profile = (req as AuthRequest).profile;
  return profile?.school_id ?? undefined;
}

/**
 * Preview rollover operation (dry-run)
 * POST /api/rollover/preview
 */
export async function previewRollover(req: Request, res: Response): Promise<void> {
  try {
    const { current_year_id, next_year_id } = req.body;
    const school_id = resolveSchoolId(req);

    if (!current_year_id || !next_year_id || !school_id) {
      res.status(400).json({
        error: 'Missing required fields: current_year_id, next_year_id, school_id',
      });
      return;
    }

    // Call the preview_rollover PostgreSQL function
    const { data, error } = await supabase.rpc('preview_rollover', {
      p_current_year_id: current_year_id,
      p_next_year_id: next_year_id,
      p_school_id: school_id,
    });

    if (error) {
      console.error('Preview rollover error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data as RolloverPreview);
  } catch (error: any) {
    console.error('Preview rollover exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Check rollover prerequisites
 * POST /api/rollover/check
 */
export async function checkPrerequisites(req: Request, res: Response): Promise<void> {
  try {
    const { current_year_id, next_year_id } = req.body;
    const school_id = resolveSchoolId(req);

    if (!current_year_id || !next_year_id || !school_id) {
      res.status(400).json({
        error: 'Missing required fields: current_year_id, next_year_id, school_id',
      });
      return;
    }

    // Call the check_rollover_prerequisites function
    const { data, error } = await supabase.rpc('check_rollover_prerequisites', {
      p_current_year_id: current_year_id,
      p_next_year_id: next_year_id,
      p_school_id: school_id,
    });

    if (error) {
      console.error('Check prerequisites error:', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // The function returns an array with single result
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    res.json(result as RolloverPrerequisiteCheck);
  } catch (error: any) {
    console.error('Check prerequisites exception:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Execute rollover operation
 * POST /api/rollover/execute
 */
export async function executeRollover(req: Request, res: Response): Promise<void> {
  try {
    const { current_year_id, next_year_id, options } = req.body as RolloverRequest;
    const school_id = resolveSchoolId(req);

    if (!current_year_id || !next_year_id || !school_id) {
      res.status(400).json({
        error: 'Missing required fields: current_year_id, next_year_id, school_id',
      });
      return;
    }

    // First check prerequisites
    const { data: checkData, error: checkError } = await supabase.rpc(
      'check_rollover_prerequisites',
      {
        p_current_year_id: current_year_id,
        p_next_year_id: next_year_id,
        p_school_id: school_id,
      }
    );

    if (checkError) {
      console.error('Prerequisites check failed:', checkError);
      res.status(500).json({ error: checkError.message });
      return;
    }

    const checkResult = Array.isArray(checkData) && checkData.length > 0 ? checkData[0] : checkData;

    if (!checkResult || !checkResult.is_valid) {
      res.status(400).json({
        success: false,
        error: checkResult?.error_message || 'Prerequisites not met',
      });
      return;
    }

    // Execute rollover
    const { data, error } = await supabase.rpc('execute_rollover', {
      p_current_year_id: current_year_id,
      p_next_year_id: next_year_id,
      p_school_id: school_id,
      p_rollover_options: options || {
        students: true,
        marking_periods: true,
        teachers: true,
      },
    });

    if (error) {
      console.error('Execute rollover error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.json(data as RolloverResult);
  } catch (error: any) {
    console.error('Execute rollover exception:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
