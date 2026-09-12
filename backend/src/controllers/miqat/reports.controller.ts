import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { miqatReportsService } from '../../services/miqat/reports.service';

class MiqatReportsController {
  async timesheet(req: AuthRequest, res: Response) {
    try {
      const month = req.query.month as string; // YYYY-MM
      if (!month) return res.status(400).json({ success: false, error: 'month (YYYY-MM) is required' });
      const { buffer, filename } = await miqatReportsService.generateTimesheet(req.profile?.school_id, month);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async ministry(req: AuthRequest, res: Response) {
    try {
      const { date_from, date_to } = req.query as { date_from?: string; date_to?: string };
      if (!date_from || !date_to) return res.status(400).json({ success: false, error: 'date_from and date_to are required' });
      const { buffer, filename } = await miqatReportsService.generateMinistryReport(req.profile?.school_id, date_from, date_to);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listFlags(req: AuthRequest, res: Response) {
    try {
      const flags = await miqatReportsService.listPatternFlags(req.profile?.school_id);
      res.json({ success: true, data: flags });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async acknowledgeFlag(req: AuthRequest, res: Response) {
    try {
      await miqatReportsService.acknowledgeFlag(req.params.id, req.profile.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const miqatReportsController = new MiqatReportsController();
