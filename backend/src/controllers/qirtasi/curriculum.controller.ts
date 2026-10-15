import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qirtasiCurriculumService, getLevelConfig, CurriculumLevel, CurriculumScopeError } from '../../services/qirtasi/curriculum.service';
import { schoolRootId } from '../../utils/campus-validation';
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

/** The main school whose curriculum this request works on (campuses share their main school's tree). */
async function curriculumSchool(req: AuthRequest, res: Response): Promise<string | null> {
  const own = req.profile?.school_id;
  const root = own ? await schoolRootId(own) : null;
  if (!root) res.status(403).json({ success: false, error: 'No school associated' });
  return root;
}

function fail(res: Response, error: any, fallback: number) {
  const status = error instanceof CurriculumScopeError ? error.status : fallback;
  res.status(status).json({ success: false, error: error.message });
}

/** Levels without a create schema (outcomes): never let the body pick the owner or the id. */
function stripProtected(body: Record<string, any>) {
  const { id: _id, school_id: _s, created_at: _c, updated_at: _u, ...rest } = body ?? {};
  return rest;
}

export class QirtasiCurriculumController {
  async list(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const schoolId = await curriculumSchool(req, res);
      if (!schoolId) return;
      const data = await qirtasiCurriculumService.list(level, schoolId, req.query.parent_id as string | undefined);
      res.json({ success: true, data });
    } catch (error: any) {
      fail(res, error, 500);
    }
  }

  async get(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const schoolId = await curriculumSchool(req, res);
      if (!schoolId) return;
      const data = await qirtasiCurriculumService.get(level, schoolId, req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      fail(res, error, 404);
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const schema = CREATE_SCHEMAS[level];
      const payload = schema ? schema.parse(req.body) : stripProtected(req.body);
      const schoolId = await curriculumSchool(req, res);
      if (!schoolId) return;
      const data = await qirtasiCurriculumService.create(level, schoolId, payload);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      fail(res, error, 400);
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const payload = updateQirtasiNodeSchema.parse(req.body);
      const schoolId = await curriculumSchool(req, res);
      if (!schoolId) return;
      const data = await qirtasiCurriculumService.update(level, schoolId, req.params.id, payload);
      res.json({ success: true, data });
    } catch (error: any) {
      fail(res, error, 400);
    }
  }

  async remove(req: AuthRequest, res: Response) {
    try {
      const level = req.params.level as CurriculumLevel;
      if (!getLevelConfig(level)) return res.status(404).json({ success: false, error: `Unknown curriculum level: ${level}` });
      const schoolId = await curriculumSchool(req, res);
      if (!schoolId) return;
      const data = await qirtasiCurriculumService.remove(level, schoolId, req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      fail(res, error, 400);
    }
  }
}

export const qirtasiCurriculumController = new QirtasiCurriculumController();
