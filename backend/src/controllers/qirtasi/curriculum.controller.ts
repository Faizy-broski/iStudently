import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qirtasiCurriculumService, getLevelConfig, CurriculumLevel } from '../../services/qirtasi/curriculum.service';
import {
  createQirtasiStageSchema, createQirtasiGradeSchema, createQirtasiTrackSchema,
  createQirtasiSubjectSchema, createQirtasiUnitSchema, createQirtasiLessonSchema,
  updateQirtasiNodeSchema,
} from '../../types/index';

const CREATE_SCHEMAS: Partial<Record<CurriculumLevel, any>> = {
  stages: createQirtasiStageSchema,
  grades: createQirtasiGradeSchema,
  tracks: createQirtasiTrackSchema,
  subjects: createQirtasiSubjectSchema,
  units: createQirtasiUnitSchema,
  lessons: createQirtasiLessonSchema,
  // terms and outcomes: no dedicated create schema in this slice (terms is a
  // fixed T1/T2 pair seeded by migration; outcomes management is deferred —
  // reads work, writes fall through to a minimal shape check below).
};

export class QirtasiCurriculumController {
  async list(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const data = await qirtasiCurriculumService.list(level, req.query.parent_id as string | undefined);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async get(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const data = await qirtasiCurriculumService.get(level, req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const schema = CREATE_SCHEMAS[level];
      const payload = schema ? schema.parse(req.body) : req.body;
      const data = await qirtasiCurriculumService.create(level, payload);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const payload = updateQirtasiNodeSchema.parse(req.body);
      const data = await qirtasiCurriculumService.update(level, req.params.id, payload);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async remove(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const data = await qirtasiCurriculumService.remove(level, req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

export const qirtasiCurriculumController = new QirtasiCurriculumController();
