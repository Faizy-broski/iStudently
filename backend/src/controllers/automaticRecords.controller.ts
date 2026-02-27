import { Request, Response } from "express";
import { AutomaticRecordsService } from "../services/automaticRecords.service";
import {
  createAutomaticRecordSchema,
  updateAutomaticRecordSchema,
  createAutoRecordExceptionSchema,
} from "../types/index";

export class AutomaticRecordsController {
  // ===========================================================================
  // RULES
  // ===========================================================================

  static async getAll(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await AutomaticRecordsService.getAll(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.getAll error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const data = await AutomaticRecordsService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.getById error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const dto = createAutomaticRecordSchema.parse(req.body);
      const data = await AutomaticRecordsService.create(dto as any);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.create error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const dto = updateAutomaticRecordSchema.parse(req.body);
      const data = await AutomaticRecordsService.update(req.params.id, dto as any);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.update error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await AutomaticRecordsService.delete(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("AutomaticRecords.delete error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ===========================================================================
  // EXCEPTIONS
  // ===========================================================================

  static async getExceptions(req: Request, res: Response) {
    try {
      const data = await AutomaticRecordsService.getExceptions(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.getExceptions error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createException(req: Request, res: Response) {
    try {
      const dto = createAutoRecordExceptionSchema.parse(req.body);
      const data = await AutomaticRecordsService.createException(dto as any);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.createException error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getSchoolExceptions(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res.status(400).json({ success: false, error: "school_id is required" });

      const { from_date, to_date, checkpoint_id, record_type } = req.query as Record<string, string>;
      const data = await AutomaticRecordsService.getSchoolExceptions(schoolId, {
        from_date,
        to_date,
        checkpoint_id,
        record_type,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.getSchoolExceptions error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async bulkCreateExceptions(req: Request, res: Response) {
    try {
      const data = await AutomaticRecordsService.bulkCreateExceptions(req.body as any);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("AutomaticRecords.bulkCreateExceptions error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteExceptionById(req: Request, res: Response) {
    try {
      await AutomaticRecordsService.deleteException(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("AutomaticRecords.deleteExceptionById error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async deleteException(req: Request, res: Response) {
    try {
      await AutomaticRecordsService.deleteException(req.params.exceptionId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("AutomaticRecords.deleteException error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
