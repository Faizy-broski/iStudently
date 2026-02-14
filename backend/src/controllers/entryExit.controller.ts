import { Request, Response } from "express";
import { EntryExitService } from "../services/entryExit.service";
import {
  createCheckpointSchema,
  updateCheckpointSchema,
  createRecordSchema,
} from "../types/index";

export class EntryExitController {
  // ========================
  // CHECKPOINTS
  // ========================

  static async getCheckpoints(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await EntryExitService.getCheckpoints(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getCheckpoints error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getCheckpointById(req: Request, res: Response) {
    try {
      const data = await EntryExitService.getCheckpointById(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getCheckpointById error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createCheckpoint(req: Request, res: Response) {
    try {
      const dto = createCheckpointSchema.parse(req.body);
      const data = await EntryExitService.createCheckpoint(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createCheckpoint error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateCheckpoint(req: Request, res: Response) {
    try {
      const dto = updateCheckpointSchema.parse(req.body);
      const data = await EntryExitService.updateCheckpoint(req.params.id, dto);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("updateCheckpoint error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteCheckpoint(req: Request, res: Response) {
    try {
      await EntryExitService.deleteCheckpoint(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("deleteCheckpoint error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ========================
  // AUTHORIZED TIMES
  // ========================

  static async getAuthorizedTimes(req: Request, res: Response) {
    try {
      const data = await EntryExitService.getAuthorizedTimes(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async setAuthorizedTimes(req: Request, res: Response) {
    try {
      const { times } = req.body;
      if (!Array.isArray(times))
        return res
          .status(400)
          .json({ success: false, error: "times must be an array" });
      const data = await EntryExitService.setAuthorizedTimes(
        req.params.id,
        times,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ========================
  // RECORDS
  // ========================

  static async createRecord(req: Request, res: Response) {
    try {
      const dto = createRecordSchema.parse(req.body);
      const data = await EntryExitService.createRecord(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createRecord error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async createBulkRecords(req: Request, res: Response) {
    try {
      const {
        school_id,
        checkpoint_id,
        person_ids,
        person_type,
        record_type,
        description,
      } = req.body;
      if (!Array.isArray(person_ids) || person_ids.length === 0) {
        return res
          .status(400)
          .json({
            success: false,
            error: "person_ids must be a non-empty array",
          });
      }
      const data = await EntryExitService.createBulkRecords({
        school_id,
        checkpoint_id,
        person_ids,
        person_type,
        record_type,
        description,
      });
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createBulkRecords error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getRecords(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await EntryExitService.getRecords({
        school_id: schoolId,
        checkpoint_id: req.query.checkpoint_id as string,
        person_type: req.query.person_type as string,
        record_type: req.query.record_type as string,
        status: req.query.status as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        person_id: req.query.person_id as string,
        last_only: req.query.last_only === "true",
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getRecords error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await EntryExitService.getStats(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getStats error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ========================
  // STUDENT NOTES
  // ========================

  static async getStudentNotes(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await EntryExitService.getStudentNotes(
        schoolId,
        req.params.id,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async upsertStudentNotes(req: Request, res: Response) {
    try {
      const schoolId = req.body.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await EntryExitService.upsertStudentNotes(
        schoolId,
        req.params.id,
        req.body.notes,
        req.body.created_by,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
