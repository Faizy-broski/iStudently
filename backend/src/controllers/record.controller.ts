import { Request, Response } from "express";
import { createRecordSchema } from "../types/index";
import { RecordService } from "../services/record.service";

export class RecordController {
  static async create(req: Request, res: Response) {
    const dto = createRecordSchema.parse(req.body);
    const record = await RecordService.create(dto);
    res.json(record);
  }

  static async list(req: Request, res: Response) {
    const records = await RecordService.list(req.query);
    res.json(records);
  }
}
