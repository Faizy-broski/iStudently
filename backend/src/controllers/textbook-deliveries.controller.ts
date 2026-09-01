import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { textbookDeliveriesService, FinancialBlockError } from '../services/textbook-deliveries.service';
import {
  syncTextbookDeliverySchema,
  bulkSyncTextbookDeliverySchema,
  returnTextbookDeliverySchema,
  bulkReturnTextbookDeliverySchema,
} from '../types/index';

/** Same convention as library.controller.ts's libSchoolId(). */
function tbSchoolId(req: AuthRequest): string | null {
  const p = req.profile;
  if (!p) return null;
  return p.campus_id || p.school_id || null;
}

function handleError(res: Response, error: any) {
  if (error instanceof FinancialBlockError || error?.code === 'FINANCIAL_BLOCK') {
    return res.status(409).json({ success: false, error: error.message, code: 'FINANCIAL_BLOCK' });
  }
  return res.status(400).json({ success: false, error: error.message });
}

export class TextbookDeliveriesController {
  async getMatrix(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const { section_id, grade_level_id } = req.query;
      if (!section_id && !grade_level_id) {
        return res.status(400).json({ success: false, error: 'section_id or grade_level_id is required' });
      }

      const data = await textbookDeliveriesService.getMatrix({
        schoolId,
        sectionId: section_id as string | undefined,
        gradeLevelId: grade_level_id as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async sync(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      const campusId = req.profile?.campus_id || schoolId;
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const dto = syncTextbookDeliverySchema.parse(req.body);
      const data = await textbookDeliveriesService.syncDelivery({
        schoolId,
        campusId,
        actor: { id: req.profile.id, role: req.profile.role },
        ...dto,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      handleError(res, error);
    }
  }

  async bulkSync(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      const campusId = req.profile?.campus_id || schoolId;
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const dto = bulkSyncTextbookDeliverySchema.parse(req.body);
      const data = await textbookDeliveriesService.bulkSyncDelivery({
        schoolId,
        campusId,
        actor: { id: req.profile.id, role: req.profile.role },
        items: dto.items,
        override: dto.override,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      handleError(res, error);
    }
  }

  async returnDelivery(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const dto = returnTextbookDeliverySchema.parse(req.body);
      const data = await textbookDeliveriesService.returnDelivery(
        req.params.id,
        schoolId,
        dto,
        { id: req.profile.id, role: req.profile.role }
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async bulkReturn(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const dto = bulkReturnTextbookDeliverySchema.parse(req.body);
      const data = await textbookDeliveriesService.bulkReturnDelivery(
        schoolId,
        dto.items,
        { id: req.profile.id, role: req.profile.role }
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getMissingSummary(req: AuthRequest, res: Response) {
    try {
      const schoolId = tbSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });
      const campusId = req.query.campus_id as string | undefined;
      const data = await textbookDeliveriesService.getMissingSummary(schoolId, req.profile?.role, campusId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const textbookDeliveriesController = new TextbookDeliveriesController();
