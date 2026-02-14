import { Request, Response } from "express";
import { HostelService } from "../services/hostel.service";
import {
  createBuildingSchema,
  updateBuildingSchema,
  createRoomSchema,
  updateRoomSchema,
  assignStudentSchema,
  createVisitSchema,
  generateRentalFeesSchema,
  recordFeePaymentSchema,
} from "../types/index";

export class HostelController {
  // ─── BUILDINGS ──────────────────────────────────────────────

  static async getBuildings(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const data = await HostelService.getBuildings(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getBuildings error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createBuilding(req: Request, res: Response) {
    try {
      const dto = createBuildingSchema.parse(req.body);
      const data = await HostelService.createBuilding(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createBuilding error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateBuilding(req: Request, res: Response) {
    try {
      const dto = updateBuildingSchema.parse(req.body);
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const data = await HostelService.updateBuilding(
        req.params.id,
        schoolId,
        dto,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("updateBuilding error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteBuilding(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      await HostelService.deleteBuilding(req.params.id, schoolId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── ROOMS ──────────────────────────────────────────────────

  static async getRooms(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const buildingId = req.query.building_id as string | undefined;
      const data = await HostelService.getRooms(schoolId, buildingId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getRooms error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createRoom(req: Request, res: Response) {
    try {
      const dto = createRoomSchema.parse(req.body);
      const data = await HostelService.createRoom(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createRoom error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async updateRoom(req: Request, res: Response) {
    try {
      const dto = updateRoomSchema.parse(req.body);
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const data = await HostelService.updateRoom(req.params.id, schoolId, dto);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("updateRoom error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteRoom(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      await HostelService.deleteRoom(req.params.id, schoolId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── ASSIGNMENTS ────────────────────────────────────────────

  static async getAssignments(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const data = await HostelService.getAssignments(schoolId, {
        building_id: req.query.building_id as string,
        room_id: req.query.room_id as string,
        active_only: req.query.active_only !== "false",
      });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getAssignments error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async assignStudent(req: Request, res: Response) {
    try {
      const dto = assignStudentSchema.parse(req.body);
      const data = await HostelService.assignStudent(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("assignStudent error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async releaseStudent(req: Request, res: Response) {
    try {
      const data = await HostelService.releaseStudent(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getStudentRoom(req: Request, res: Response) {
    try {
      const data = await HostelService.getStudentRoom(req.params.studentId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── VISITS ─────────────────────────────────────────────────

  static async getVisits(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const data = await HostelService.getVisits(schoolId, {
        student_id: req.query.student_id as string,
        room_id: req.query.room_id as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        active_only: req.query.active_only === "true",
      });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getVisits error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createVisit(req: Request, res: Response) {
    try {
      const dto = createVisitSchema.parse(req.body);
      const data = await HostelService.createVisit(dto);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("createVisit error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async checkOutVisit(req: Request, res: Response) {
    try {
      const data = await HostelService.checkOutVisit(req.params.id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── RENTAL FEES ────────────────────────────────────────────

  static async getRentalFees(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const data = await HostelService.getRentalFees(schoolId, {
        student_id: req.query.student_id as string,
        status: req.query.status as string,
        period_start: req.query.period_start as string,
        period_end: req.query.period_end as string,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getRentalFees error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async generateRentalFees(req: Request, res: Response) {
    try {
      const dto = generateRentalFeesSchema.parse(req.body);
      const result = await HostelService.generateRentalFees(dto);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      console.error("generateRentalFees error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async recordFeePayment(req: Request, res: Response) {
    try {
      const dto = recordFeePaymentSchema.parse(req.body);
      const data = await HostelService.recordFeePayment(
        dto.fee_id,
        dto.amount,
        dto.notes,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("recordFeePayment error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // ─── FILES ──────────────────────────────────────────────────

  static async getFiles(req: Request, res: Response) {
    try {
      const entityType = req.query.entity_type as string;
      const entityId = req.query.entity_id as string;
      if (!entityType || !entityId)
        return res.status(400).json({
          success: false,
          error: "entity_type and entity_id are required",
        });
      const data = await HostelService.getFiles(entityType, entityId);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async addFile(req: Request, res: Response) {
    try {
      const data = await HostelService.addFile(req.body);
      res.status(201).json({ success: true, data });
    } catch (err: any) {
      console.error("addFile error:", err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  static async deleteFile(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      await HostelService.deleteFile(req.params.id, schoolId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── SEARCH ─────────────────────────────────────────────────

  static async searchStudents(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });

      const buildingId = req.query.building_id as string;
      const roomId = req.query.room_id as string;

      let data;
      if (roomId) {
        data = await HostelService.searchStudentsByRoom(schoolId, roomId);
      } else if (buildingId) {
        data = await HostelService.searchStudentsByBuilding(
          schoolId,
          buildingId,
        );
      } else {
        return res.status(400).json({
          success: false,
          error: "building_id or room_id is required",
        });
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── STATS ──────────────────────────────────────────────────

  static async getStats(req: Request, res: Response) {
    try {
      const schoolId = req.query.school_id as string;
      if (!schoolId)
        return res
          .status(400)
          .json({ success: false, error: "school_id is required" });
      const data = await HostelService.getStats(schoolId);
      res.json({ success: true, data });
    } catch (err: any) {
      console.error("getStats error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
