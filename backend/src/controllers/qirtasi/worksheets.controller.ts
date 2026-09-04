import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { supabase } from '../../config/supabase';
import { matchesFileSignature } from '../../utils/file-signature';
import { qirtasiWorksheetsService, QIRTASI_WORKSHEET_BUCKET, QirtasiWorksheet } from '../../services/qirtasi/worksheets.service';
import { createQirtasiWorksheetSchema, updateQirtasiWorksheetSchema } from '../../types/index';

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Resolves the campus/school id to store or query worksheets under. Must
 * check req.query.campus_id / req.body.campus_id BEFORE req.profile.campus_id
 * — admin accounts never get campus_id auto-populated on req.profile (only
 * teacher/student/parent/staff/librarian do, see auth.middleware.ts), so an
 * admin's requests always carry it explicitly instead. Same resolution order
 * as qirtasi-enabled.middleware.ts, which gates these routes — using a
 * different order here would let a request pass the gate for one campus
 * while writing/reading data under a different one.
 */
function wsSchoolId(req: AuthRequest): string | null {
  const p = req.profile;
  const fromRequest = (req.query.campus_id as string | undefined) || req.body?.campus_id;
  if (fromRequest) return fromRequest;
  if (!p) return null;
  return p.campus_id || p.school_id || null;
}

function canManage(req: AuthRequest, worksheet: Pick<QirtasiWorksheet, 'owner_id'>): boolean {
  const role = req.profile?.role;
  if (role === 'admin' || role === 'super_admin' || role === 'librarian') return true;
  return !!req.profile?.id && req.profile.id === worksheet.owner_id;
}

function isStaffRole(req: AuthRequest): boolean {
  const role = req.profile?.role;
  return role === 'admin' || role === 'super_admin' || role === 'librarian' || role === 'teacher';
}

type UploadedFiles = Record<string, Express.Multer.File[] | undefined>;
type ValidationResult = { ok: true; ext: string } | { ok: false; status: number; error: string };

function validateFile(file: Express.Multer.File): ValidationResult {
  if (file.size > MAX_SIZE_BYTES) return { ok: false, status: 413, error: 'File too large (max 25MB)' };
  const mimeBase = file.mimetype.split(';')[0].trim().toLowerCase();
  const ext = ALLOWED_TYPES[mimeBase];
  if (!ext) return { ok: false, status: 415, error: `Unsupported file type: ${file.mimetype}` };
  if (!matchesFileSignature(file.buffer, mimeBase)) return { ok: false, status: 415, error: 'File content does not match its declared type' };
  return { ok: true, ext };
}

const ROLE_BY_FIELD: Record<string, string> = { file: 'primary', thumbnail: 'thumbnail', answerKey: 'answer_key' };

export class QirtasiWorksheetsController {
  async listWorksheets(req: AuthRequest, res: Response) {
    try {
      const schoolId = wsSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const { grade_id, subject_id, track_id, term_id, unit_id, lesson_id, worksheet_type, facet_value_ids, search, campus_id, limit, offset } = req.query;
      const result = await qirtasiWorksheetsService.listWorksheets(schoolId, req.profile?.role, {
        grade_id: grade_id as string | undefined,
        subject_id: subject_id as string | undefined,
        track_id: track_id as string | undefined,
        term_id: term_id as string | undefined,
        unit_id: unit_id as string | undefined,
        lesson_id: lesson_id as string | undefined,
        worksheet_type: worksheet_type as string | undefined,
        facet_value_ids: facet_value_ids ? String(facet_value_ids).split(',').filter(Boolean) : undefined,
        search: search as string | undefined,
        campus_id: campus_id as string | undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      res.json({ success: true, data: result.data, count: result.count });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getWorksheetById(req: AuthRequest, res: Response) {
    try {
      const data = await qirtasiWorksheetsService.getWorksheetById(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  async createWorksheet(req: AuthRequest, res: Response) {
    const uploadedPaths: string[] = [];
    try {
      const schoolId = wsSchoolId(req);
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' });

      const files = (req.files as UploadedFiles) ?? {};
      const mainFile = files.file?.[0];
      if (!mainFile) return res.status(400).json({ success: false, error: 'No worksheet file uploaded' });

      let dto;
      try {
        dto = createQirtasiWorksheetSchema.parse({
          title_ar: req.body.title_ar,
          title_en: req.body.title_en || undefined,
          description: req.body.description || undefined,
          worksheet_type: req.body.worksheet_type,
          grade_id: req.body.grade_id,
          subject_id: req.body.subject_id,
          track_id: req.body.track_id || null,
          term_id: req.body.term_id || null,
          unit_id: req.body.unit_id || null,
          lesson_id: req.body.lesson_id || null,
          visibility_scope: req.body.visibility_scope || undefined,
          facet_value_ids: req.body.facet_value_ids ? JSON.parse(req.body.facet_value_ids) : undefined,
        });
      } catch (parseErr: any) {
        return res.status(400).json({ success: false, error: parseErr.message });
      }

      const worksheetId = randomUUID(); // used only for the storage path prefix, not the DB id
      const assets: { storage_key: string; mime_type: string; file_size: number; asset_role: string }[] = [];

      for (const field of ['file', 'thumbnail', 'answerKey'] as const) {
        const file = files[field]?.[0];
        if (!file) continue;
        const check = validateFile(file);
        if (check.ok === false) {
          await this.cleanupPaths(uploadedPaths);
          return res.status(check.status).json({ success: false, error: `${field}: ${check.error}` });
        }
        const path = `${schoolId}/${worksheetId}/${ROLE_BY_FIELD[field]}-${randomUUID()}.${check.ext}`;
        const { error } = await supabase.storage.from(QIRTASI_WORKSHEET_BUCKET).upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
        if (error) {
          await this.cleanupPaths(uploadedPaths);
          return res.status(500).json({ success: false, error: `Storage upload failed (${field}): ${error.message}` });
        }
        uploadedPaths.push(path);
        assets.push({ storage_key: path, mime_type: file.mimetype, file_size: file.size, asset_role: ROLE_BY_FIELD[field] });
      }

      try {
        const data = await qirtasiWorksheetsService.createWorksheet(dto, schoolId, req.profile?.id || null, assets);
        return res.status(201).json({ success: true, data });
      } catch (dbError: any) {
        await this.cleanupPaths(uploadedPaths);
        return res.status(500).json({ success: false, error: dbError.message });
      }
    } catch (error: any) {
      await this.cleanupPaths(uploadedPaths);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async cleanupPaths(paths: string[]) {
    if (paths.length === 0) return;
    await supabase.storage.from(QIRTASI_WORKSHEET_BUCKET).remove(paths).catch(() => {});
  }

  async updateWorksheet(req: AuthRequest, res: Response) {
    try {
      const existing = await qirtasiWorksheetsService.getWorksheetById(req.params.id);
      if (!canManage(req, existing)) {
        return res.status(403).json({ success: false, error: 'Only the owner, an admin, or a librarian can edit this worksheet' });
      }
      const dto = updateQirtasiWorksheetSchema.parse(req.body);
      const data = await qirtasiWorksheetsService.updateWorksheet(req.params.id, dto);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteWorksheet(req: AuthRequest, res: Response) {
    try {
      const existing = await qirtasiWorksheetsService.getWorksheetById(req.params.id);
      if (!canManage(req, existing)) {
        return res.status(403).json({ success: false, error: 'Only the owner, an admin, or a librarian can delete this worksheet' });
      }
      const paths = await qirtasiWorksheetsService.deleteWorksheet(req.params.id);
      await this.cleanupPaths(paths);
      res.json({ success: true, data: { success: true } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async downloadWorksheet(req: AuthRequest, res: Response) {
    try {
      const data = await qirtasiWorksheetsService.mintAssetUrl(req.params.id, 'primary');
      if (!data) return res.status(404).json({ success: false, error: 'File not found' });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  async thumbnailWorksheet(req: AuthRequest, res: Response) {
    try {
      const data = await qirtasiWorksheetsService.mintAssetUrl(req.params.id, 'thumbnail');
      res.json({ success: true, data: { url: data?.url ?? null } });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  async answerKeyWorksheet(req: AuthRequest, res: Response) {
    try {
      if (!isStaffRole(req)) {
        return res.status(403).json({ success: false, error: 'Answer keys are only visible to staff' });
      }
      const data = await qirtasiWorksheetsService.mintAssetUrl(req.params.id, 'answer_key');
      res.json({ success: true, data: { url: data?.url ?? null } });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }
}

export const qirtasiWorksheetsController = new QirtasiWorksheetsController();
