import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziMinistrySyllabusService } from '../../services/hifzi/ministry-syllabus.service'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('Unknown') || msg.includes('not found') ? 404 : msg.includes('requires') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

// Same campus_id resolution as plans.controller.ts's createPlan/updatePlan —
// req.profile.school_id alone is the PARENT org for an admin, but Hifzi
// tenant tables (hifzi_ministry_syllabus included) key off the campus id.
function resolveSchoolId(req: AuthRequest): string {
  return (req.body.campus_id as string | undefined) || (req.query.campus_id as string | undefined) || req.profile?.campus_id || req.profile.school_id
}

export const upsertSyllabusTarget = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req)
    const body = req.body
    const range = body.range?.start_number !== undefined
      ? { unitType: body.range.unit_type, startNumber: body.range.start_number, endNumber: body.range.end_number }
      : {
          unitType: body.range?.unit_type,
          number: body.range?.number,
          editionCode: body.range?.edition_code,
          startAyah: body.range?.start_ayah,
          endAyah: body.range?.end_ayah,
        }

    const data = await hifziMinistrySyllabusService.upsertSyllabusTarget(schoolId, {
      gradeLevelId: body.grade_level_id,
      ministryGradeNumber: Number(body.ministry_grade_number),
      academicYearId: body.academic_year_id,
      riwayahId: body.riwayah_id,
      range: range as any,
      unitLabel: body.unit_label ?? null,
      notes: body.notes ?? null,
      createdBy: req.profile.id,
    })
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listSyllabusTargets = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req)
    const data = await hifziMinistrySyllabusService.listSyllabusTargets(
      schoolId,
      req.query.academic_year_id as string,
      req.query.grade_level_id as string | undefined
    )
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
