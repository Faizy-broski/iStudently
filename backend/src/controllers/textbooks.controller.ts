import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { textbooksService } from '../services/textbooks.service';
import { createTextbookSchema, updateTextbookSchema, restockTextbookSchema } from '../types/index';

/**
 * Returns the correct school_id for textbook queries. Same convention as
 * library.controller.ts's libSchoolId(): textbook data is stored with the
 * CAMPUS id, so we must always prefer campus_id over the parent school_id.
 */
function tbSchoolId(req: AuthRequest): string | null {
  const p = req.profile;
  if (!p) return null;
  return p.campus_id || p.school_id || null;
}

export class TextbooksController {
  async getTextbooks(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const { grade_level_id, is_active, campus_id } = req.query;
      const data = await textbooksService.getTextbooks(schoolId, req.profile?.role, {
        grade_level_id: grade_level_id as string | undefined,
        is_active: is_active === undefined ? undefined : is_active === 'true',
        campus_id: campus_id as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTextbookById(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });
      const data = await textbooksService.getTextbookById(req.params.id, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createTextbook(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });
      const dto = createTextbookSchema.parse(req.body);
      const data = await textbooksService.createTextbook(dto, req.profile?.school_id, dto.campus_id || schoolId);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateTextbook(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });
      const dto = updateTextbookSchema.parse(req.body);
      const data = await textbooksService.updateTextbook(req.params.id, dto, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteTextbook(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });
      const data = await textbooksService.deleteTextbook(req.params.id, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async restockTextbook(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });
      const { amount } = restockTextbookSchema.parse(req.body);
      const data = await textbooksService.restock(req.params.id, amount, schoolId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

export const textbooksController = new TextbooksController();
