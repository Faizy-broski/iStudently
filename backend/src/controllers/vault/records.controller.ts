import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as recordsService from '../../services/vault/records.service'
import { callerFromVaultRequest as callerFrom } from '../../utils/vault-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : msg.includes('required') || msg.includes('not an encrypted secret') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

export const listRecords = async (req: AuthRequest, res: Response) => {
  try {
    const data = await recordsService.listRecords(await callerFrom(req), {
      category: req.query.category as string | undefined,
    })
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getRecord = async (req: AuthRequest, res: Response) => {
  try {
    const data = await recordsService.getRecord(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const createRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { category, sub_category, title, default_fields, custom_fields, attachments, expiry_date } = req.body
    if (!category || !sub_category || !title) {
      return res.status(400).json({ success: false, error: 'category, sub_category, and title are required' })
    }
    const data = await recordsService.createRecord(
      await callerFrom(req),
      {
        category,
        subCategory: sub_category,
        title,
        defaultFields: default_fields,
        customFields: custom_fields,
        attachments,
        expiryDate: expiry_date,
      },
      req.ip ?? null
    )
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const updateRecord = async (req: AuthRequest, res: Response) => {
  try {
    const { title, sub_category, default_fields, custom_fields, attachments, expiry_date } = req.body
    const data = await recordsService.updateRecord(
      await callerFrom(req),
      req.params.id,
      {
        title,
        subCategory: sub_category,
        defaultFields: default_fields,
        customFields: custom_fields,
        attachments,
        expiryDate: expiry_date,
      },
      req.ip ?? null
    )
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const deleteRecord = async (req: AuthRequest, res: Response) => {
  try {
    await recordsService.deleteRecord(await callerFrom(req), req.params.id, req.ip ?? null)
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const revealSecret = async (req: AuthRequest, res: Response) => {
  try {
    const { field_key } = req.body
    if (!field_key) return res.status(400).json({ success: false, error: 'field_key is required' })
    const value = await recordsService.revealSecret(await callerFrom(req), req.params.id, field_key, req.ip ?? null)
    return res.json({ success: true, data: { value } })
  } catch (error: any) {
    return handleError(res, error)
  }
}
