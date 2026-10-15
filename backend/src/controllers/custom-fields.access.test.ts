const getFieldDefinitions = jest.fn(async () => [])
const reorderFields = jest.fn(async () => undefined)
jest.mock('../services/custom-fields.service', () => ({ customFieldsService: { getFieldDefinitions, reorderFields } }))
// Campus "c-own" belongs to school "s-own"; "c-foreign" does not.
jest.mock('../utils/campus-validation', () => ({
  resolveSchoolId: async (req: any, requested?: string) => {
    if (req.profile?.role === 'super_admin') return { schoolId: requested || req.profile.school_id }
    if (!requested || requested === req.profile.school_id || requested === 'c-own') return { schoolId: requested || req.profile.school_id }
    return { schoolId: null, error: 'Forbidden: school_id does not match your account', status: 403 }
  },
}))

import { CustomFieldsController } from './custom-fields.controller'

const ctrl = new CustomFieldsController()
function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
const next = jest.fn()
beforeEach(() => jest.clearAllMocks())

describe('custom fields read', () => {
  it("refuses another school's campus", async () => {
    const res = mockRes()
    await ctrl.getFieldDefinitions({ profile: { role: 'admin', school_id: 's-own' }, params: { entityType: 'student' }, query: { campus_id: 'c-foreign' } } as any, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(getFieldDefinitions).not.toHaveBeenCalled()
  })
  it('allows own campus', async () => {
    await ctrl.getFieldDefinitions({ profile: { role: 'teacher', school_id: 's-own' }, params: { entityType: 'student' }, query: { campus_id: 'c-own' } } as any, mockRes(), next)
    expect(getFieldDefinitions).toHaveBeenCalledWith('c-own', 'student')
  })
  it('super admin can read any school', async () => {
    await ctrl.getFieldDefinitions({ profile: { role: 'super_admin', school_id: null }, params: { entityType: 'school' }, query: { campus_id: 'c-foreign' } } as any, mockRes(), next)
    expect(getFieldDefinitions).toHaveBeenCalledWith('c-foreign', 'school')
  })
})

describe('custom fields reorder', () => {
  const body = { category_id: 'cat', items: [{ id: 'f', sort_order: 1 }] }
  it('non-admins are refused', async () => {
    const res = mockRes()
    await ctrl.reorderFields({ profile: { role: 'teacher', school_id: 's-own' }, query: {}, body } as any, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(reorderFields).not.toHaveBeenCalled()
  })
  it("admin can't reorder another school's fields", async () => {
    const res = mockRes()
    await ctrl.reorderFields({ profile: { role: 'admin', school_id: 's-own' }, query: { campus_id: 'c-foreign' }, body } as any, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(reorderFields).not.toHaveBeenCalled()
  })
  it('admin reorders own school', async () => {
    await ctrl.reorderFields({ profile: { role: 'admin', school_id: 's-own' }, query: {}, body } as any, mockRes(), next)
    expect(reorderFields).toHaveBeenCalledWith('s-own', 'cat', body.items)
  })
})
