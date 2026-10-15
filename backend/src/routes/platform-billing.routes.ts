// Super-admin platform billing: /api/platform-billing/* (replaces the web's direct Supabase access
// to billing_plans / billing_records). Every route: authenticate + requireSuperAdmin.
import express, { Request, Response } from 'express'
import { z } from 'zod'

import { authenticate } from '../middlewares/auth.middleware'
import { requireSuperAdmin } from '../middlewares/role.middleware'
import * as billing from '../services/platform-billing.service'

const router = express.Router()
router.use(authenticate, requireSuperAdmin)

const money = z.number().min(0).max(100_000_000)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const uuid = z.string().uuid()

const planSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  monthly_price: money,
  quarterly_price: money,
  yearly_price: money,
  max_students: z.number().int().min(0).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  is_active: z.boolean().optional(),
})

const recordSchema = z.object({
  school_id: uuid,
  billing_plan_id: uuid,
  billing_cycle: z.enum(['Monthly', 'Quarterly', 'Yearly']),
  amount: money,
  currency: z.string().trim().toUpperCase().length(3),
  start_date: date,
  due_date: date,
  payment_status: z.enum(['paid', 'unpaid', 'overdue', 'pending']),
  payment_date: date.nullable().optional(),
  payment_method: z.string().trim().max(60).nullable().optional(),
  transaction_id: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
})

const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['paid', 'unpaid', 'overdue', 'pending']).optional(),
  school_id: uuid.optional(),
  search: z.string().trim().max(100).optional(),
  due_from: date.optional(),
  due_to: date.optional(),
})

type Handler = (req: Request, res: Response) => Promise<unknown>

/** Wraps a handler: zod errors -> 400, BillingError -> its status, anything else -> 500. */
const handle = (fn: Handler) => async (req: Request, res: Response) => {
  try {
    await fn(req, res)
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`) })
    }
    if (e instanceof billing.BillingError) return res.status(e.status).json({ success: false, error: e.message })
    console.error('[platform-billing]', e?.message || e)
    return res.status(500).json({ success: false, error: 'Billing request failed' })
  }
}

const idParam = (req: Request) => uuid.parse(req.params.id)

// Plans
router.get('/plans', handle(async (req, res) => {
  res.json({ success: true, data: await billing.listPlans(req.query.include_inactive === 'true') })
}))
router.post('/plans', handle(async (req, res) => {
  res.status(201).json({ success: true, data: await billing.createPlan(planSchema.parse(req.body)) })
}))
router.put('/plans/:id', handle(async (req, res) => {
  res.json({ success: true, data: await billing.updatePlan(idParam(req), planSchema.partial().parse(req.body)) })
}))
router.delete('/plans/:id', handle(async (req, res) => {
  await billing.deletePlan(idParam(req))
  res.json({ success: true })
}))

// Records (invoices)
router.get('/records', handle(async (req, res) => {
  const { rows, pagination } = await billing.listRecords(listSchema.parse(req.query))
  res.json({ success: true, data: rows, pagination })
}))
router.get('/records/:id', handle(async (req, res) => {
  res.json({ success: true, data: await billing.getRecord(idParam(req)) })
}))
router.post('/records', handle(async (req, res) => {
  res.status(201).json({ success: true, data: await billing.createRecord(recordSchema.parse(req.body)) })
}))
router.put('/records/:id', handle(async (req, res) => {
  res.json({ success: true, data: await billing.updateRecord(idParam(req), recordSchema.partial().parse(req.body)) })
}))
router.post('/records/:id/mark-paid', handle(async (req, res) => {
  const body = z.object({ payment_date: date.optional() }).parse(req.body ?? {})
  res.json({ success: true, data: await billing.markRecordPaid(idParam(req), body.payment_date) })
}))
router.delete('/records/:id', handle(async (req, res) => {
  await billing.deleteRecord(idParam(req))
  res.json({ success: true })
}))

export default router
