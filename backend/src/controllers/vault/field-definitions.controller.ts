import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as fieldDefService from '../../services/vault/field-definitions.service'
import { callerFromVaultRequest as callerFrom } from '../../utils/vault-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : msg.includes('required') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listFieldDefinitions = async (req: AuthRequest, res: Response) => {
  try {
    const data = await fieldDefService.listFieldDefinitions(await callerFrom(req), req.query.category as string | undefined)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const createFieldDefinition = async (req: AuthRequest, res: Response) => {
  try {
    const { category, field_key, label_en, label_ar, field_type, options, is_required, is_secret, sort_order } = req.body
    if (!category || !field_key || !label_en || !label_ar || !field_type) {
      return res.status(400).json({ success: false, error: 'category, field_key, label_en, label_ar, and field_type are required' })
    }
    const data = await fieldDefService.createFieldDefinition(
      await callerFrom(req),
      {
        category,
        fieldKey: field_key,
        labelEn: label_en,
        labelAr: label_ar,
        fieldType: field_type,
        options,
        isRequired: is_required,
        isSecret: is_secret,
        sortOrder: sort_order,
      },
      req.ip ?? null
    )
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteFieldDefinition = async (req: AuthRequest, res: Response) => {
  try {
    await fieldDefService.deleteFieldDefinition(await callerFrom(req), req.params.id, req.ip ?? null)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}
