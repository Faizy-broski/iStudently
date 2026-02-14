import { Request, Response } from "express";
import { EveningLeaveService } from "../services/eveningLeave.service";
import {
  createEveningLeaveSchema,
  updateEveningLeaveSchema,
} from "../types/index";

export class EveningLeaveController {
  static async create(req: Request, res: Response) {
    try {
      const dto = createEveningLeaveSchema.parse(req.body);
      const data = await EveningLeaveService.create(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createEveningLeave error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await EveningLeaveService.getAll({
        school_id: schoolId,
        student_id: req.query.student_id as string,
        is_active:
          req.query.is_active !== undefined
            ? req.query.is_active === "true"
            : undefined,
        date: req.query.date as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getEveningLeaves error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const data = await EveningLeaveService.getById(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const dto = updateEveningLeaveSchema.parse(req.body);
      const data = await EveningLeaveService.update(req.params.id, dto);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("updateEveningLeave error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await EveningLeaveService.delete(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getReport(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await EveningLeaveService.getReport(
        schoolId,
        req.query.date as string,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getEveningLeaveReport error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
