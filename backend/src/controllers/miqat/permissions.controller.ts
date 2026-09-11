import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatService } from '../../services/miqat/miqat.service';
import { onMiqatPermissionDecided } from '../../listeners/fina-miqat-permission-decision.listener';

const createSchema = z.object({
  person_id: z.string().uuid(),
  type: z.enum(['late_arrival', 'early_departure', 'full_day']),
  date_from: z.string(),
  date_to: z.string(),
  reason: z.string().optional(),
  attachment_ref: z.string().optional(),
  collector_name: z.string().optional(),
  collector_relation: z.string().optional(),
});

class MiqatPermissionsController {
  /** Guardian or staff submits a request — early-departure collector fields are a child-safety requirement, spec §8.4. */
  async create(req: AuthRequest, res: Response) {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid permission request', details: parsed.error.flatten() });
      }
      const row = await miqatService.createPermission({
        ...parsed.data,
        school_id: req.profile?.school_id,
        requested_by: req.profile.id,
      });
      res.status(201).json({ success: true, data: row });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Admin decision — approval suppresses the corresponding lateness/absence penalty (applied by the next days-recompute run). */
  async decide(req: AuthRequest, res: Response) {
    try {
      const schema = z.object({ status: z.enum(['approved', 'rejected']) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'status must be approved or rejected' });
      }
      const row = await miqatService.decidePermission(req.params.id, parsed.data.status, req.profile.id);
      void onMiqatPermissionDecided(row.school_id, row.requested_by, row.type, parsed.data.status);
      res.json({ success: true, data: row });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const miqatPermissionsController = new MiqatPermissionsController();
