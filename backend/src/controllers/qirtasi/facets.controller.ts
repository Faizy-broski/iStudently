import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qirtasiFacetsService } from '../../services/qirtasi/facets.service';

export class QirtasiFacetsController {
  async list(_req: AuthRequest, res: Response) {
    try {
      const data = await qirtasiFacetsService.listFacets();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const qirtasiFacetsController = new QirtasiFacetsController();
