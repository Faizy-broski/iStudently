import { Request, Response } from "express";
import { PackageService } from "../services/package.service";
import { createPackageSchema } from "../types/index";

export class PackageController {
  static async create(req: Request, res: Response) {
    try {
      const dto = createPackageSchema.parse(req.body);
      const data = await PackageService.create(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createPackage error:", err);
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

      const data = await PackageService.getAll({
        school_id: schoolId,
        student_id: req.query.student_id as string,
        status: req.query.status as string,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getPackages error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getPending(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const data = await PackageService.getPending(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async pickup(req: Request, res: Response) {
    try {
      const data = await PackageService.pickup(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("pickupPackage error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
