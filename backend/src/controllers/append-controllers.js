const fs = require('fs');

const teacherCtrl = `
export const groupAssignTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const effectiveSchoolId = getEffectiveSchoolId(req)
    validateCampusAccess(req, effectiveSchoolId)

    const result = await teacherService.groupAssignTeachers(effectiveSchoolId, {
      teacher_ids: req.body.teacher_ids,
      is_active: req.body.is_active,
      custom_field_updates: req.body.custom_field_updates
    })

    res.status(200).json({ success: true, data: result })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
}
`;
fs.appendFileSync('d:/thesocialnexus/studently/backend/src/controllers/teacher.controller.ts', teacherCtrl);

const staffCtrl = `
export const groupAssignStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const effectiveSchoolId = getEffectiveSchoolId(req)
    validateCampusAccess(req, effectiveSchoolId)

    const result = await staffService.groupAssignStaff(effectiveSchoolId, {
      staff_ids: req.body.staff_ids,
      is_active: req.body.is_active,
      custom_field_updates: req.body.custom_field_updates
    })

    res.status(200).json({ success: true, data: result })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
}
`;
fs.appendFileSync('d:/thesocialnexus/studently/backend/src/controllers/staff.controller.ts', staffCtrl);

let parentCtrlContent = fs.readFileSync('d:/thesocialnexus/studently/backend/src/controllers/parent.controller.ts', 'utf8');
const parentCtrlMethod = `
  async groupAssignParents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const effectiveSchoolId = getEffectiveSchoolId(req)
      validateCampusAccess(req, effectiveSchoolId)

      const result = await parentService.groupAssignParents(effectiveSchoolId, {
        parent_ids: req.body.parent_ids,
        is_active: req.body.is_active,
        custom_field_updates: req.body.custom_field_updates
      })

      res.status(200).json({ success: true, data: result })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
`;
const lastBrace = parentCtrlContent.lastIndexOf('}');
if (lastBrace !== -1) {
  parentCtrlContent = parentCtrlContent.substring(0, lastBrace) + parentCtrlMethod + '\n}\n';
  fs.writeFileSync('d:/thesocialnexus/studently/backend/src/controllers/parent.controller.ts', parentCtrlContent);
}

