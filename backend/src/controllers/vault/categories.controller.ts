import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as svc from '../../services/vault/categories.service'
import { callerFromVaultRequest as callerFrom } from '../../utils/vault-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : msg.includes('required') || msg.includes('already exists') || msg.includes('must be') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listCategories = async (req: AuthRequest, res: Response) => {
  try {
    const caller = await callerFrom(req)
    const data = await svc.listCustomCategories(caller.schoolId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id, label_en, label_ar } = req.body
    if (!id || !label_en || !label_ar) {
      return res.status(400).json({ success: false, error: 'id, label_en, and label_ar are required' })
    }
    const caller = await callerFrom(req)
    const data = await svc.createCustomCategory(caller, { id, label_en, label_ar }, req.ip ?? null)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const caller = await callerFrom(req)
    await svc.deleteCustomCategory(caller, req.params.id, req.ip ?? null)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { label_en, label_ar } = req.body
    if (!label_en || !label_ar) {
      return res.status(400).json({ success: false, error: 'label_en and label_ar are required' })
    }
    const caller = await callerFrom(req)
    const data = await svc.updateCustomCategory(caller, req.params.id, { label_en, label_ar }, req.ip ?? null)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
