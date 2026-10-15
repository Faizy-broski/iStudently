// Platform billing (super admin): plans and per-school invoices.
//
// The web used to read/write `billing_plans` / `billing_records` straight from the browser with the
// Supabase client (frontend/src/lib/api/billing.ts), with no server-side role check and invoice
// numbers made in the browser. This service is the server-side replacement used by the app (and the
// web once it switches): super-admin only (enforced in the routes), validated, paged.

import crypto from 'crypto'
import { supabase } from '../config/supabase'

export type BillingCycle = 'Monthly' | 'Quarterly' | 'Yearly'
export type PaymentStatus = 'paid' | 'unpaid' | 'overdue' | 'pending'

const RECORD_SELECT = `
  *,
  school:schools!billing_records_school_id_fkey(name),
  plan:billing_plans!billing_records_billing_plan_id_fkey(name)
`

/** Thrown for problems the client should see (status + message). */
export class BillingError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** INV-2026-7KQ2M9XA: year + 8 random base32 chars (no collisions in practice, unlike Date.now()). */
export function generateInvoiceNumber(now: Date = new Date()): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(8)
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  return `INV-${now.getFullYear()}-${suffix}`
}

const todayIso = (now = new Date()) => now.toISOString().slice(0, 10)

/**
 * Nothing marks invoices overdue in the database, so an unpaid/pending invoice past its due date is
 * reported as overdue (`effective_status`). The stored `payment_status` is left as is.
 */
export function effectiveStatus(paymentStatus: string, dueDate: string | null | undefined, today = todayIso()): PaymentStatus {
  if ((paymentStatus === 'unpaid' || paymentStatus === 'pending') && dueDate && dueDate < today) return 'overdue'
  return paymentStatus as PaymentStatus
}

function flattenRecord(row: any) {
  if (!row) return row
  const { school, plan, ...rest } = row
  return {
    ...rest,
    school_name: school?.name ?? null,
    subscription_plan: plan?.name ?? null,
    effective_status: effectiveStatus(rest.payment_status, rest.due_date),
  }
}

/** Escape LIKE wildcards in user search text. */
function likeTerm(search: string) {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

// ── Plans ────────────────────────────────────────────────────────────────────

export interface PlanInput {
  name: string
  description?: string | null
  monthly_price: number
  quarterly_price: number
  yearly_price: number
  max_students?: number | null
  features?: string[]
  is_active?: boolean
}

export async function listPlans(includeInactive = false) {
  let q = supabase.from('billing_plans').select('*').order('monthly_price', { ascending: true })
  if (!includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createPlan(input: PlanInput) {
  const { data, error } = await supabase.from('billing_plans').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updatePlan(id: string, input: Partial<PlanInput>) {
  const { data, error } = await supabase.from('billing_plans').update(input).eq('id', id).select().maybeSingle()
  if (error) throw error
  if (!data) throw new BillingError(404, 'Plan not found')
  return data
}

export async function deletePlan(id: string) {
  const { count } = await supabase
    .from('billing_records')
    .select('id', { count: 'exact', head: true })
    .eq('billing_plan_id', id)
  if ((count ?? 0) > 0) {
    throw new BillingError(409, 'This plan is used by existing invoices. Deactivate it instead of deleting.')
  }
  const { error } = await supabase.from('billing_plans').delete().eq('id', id)
  if (error) throw error
}

// ── Records ──────────────────────────────────────────────────────────────────

export interface RecordFilters {
  page?: number
  limit?: number
  status?: PaymentStatus
  school_id?: string
  search?: string
  due_from?: string
  due_to?: string
}

export async function listRecords(filters: RecordFilters) {
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100)
  const page = Math.max(filters.page ?? 1, 1)
  const from = (page - 1) * limit

  let q = supabase.from('billing_records').select(RECORD_SELECT, { count: 'exact' }).order('created_at', { ascending: false })
  // Filter by effective status (see effectiveStatus): "overdue" includes past-due unpaid/pending.
  const today = todayIso()
  if (filters.status === 'overdue') {
    q = q.or(`payment_status.eq.overdue,and(payment_status.in.(unpaid,pending),due_date.lt.${today})`)
  } else if (filters.status === 'unpaid' || filters.status === 'pending') {
    q = q.eq('payment_status', filters.status).gte('due_date', today)
  } else if (filters.status) {
    q = q.eq('payment_status', filters.status)
  }
  if (filters.school_id) q = q.eq('school_id', filters.school_id)
  if (filters.due_from) q = q.gte('due_date', filters.due_from)
  if (filters.due_to) q = q.lte('due_date', filters.due_to)
  if (filters.search?.trim()) q = q.ilike('invoice_number', likeTerm(filters.search.trim()))

  const { data, error, count } = await q.range(from, from + limit - 1)
  if (error) throw error
  const total = count ?? 0
  return {
    rows: (data || []).map(flattenRecord),
    pagination: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  }
}

export async function getRecord(id: string) {
  const { data, error } = await supabase.from('billing_records').select(RECORD_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new BillingError(404, 'Billing record not found')
  return flattenRecord(data)
}

export interface RecordInput {
  school_id: string
  billing_plan_id: string
  billing_cycle: BillingCycle
  amount: number
  currency: string
  start_date: string
  due_date: string
  payment_status: PaymentStatus
  payment_date?: string | null
  payment_method?: string | null
  transaction_id?: string | null
  notes?: string | null
}

export async function createRecord(input: RecordInput) {
  // Retry on the (very unlikely) invoice number collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('billing_records')
      .insert({ ...input, invoice_number: generateInvoiceNumber() })
      .select(RECORD_SELECT)
      .single()
    if (!error) return flattenRecord(data)
    if (error.code !== '23505') throw error
  }
  throw new BillingError(500, 'Could not generate a unique invoice number')
}

export async function updateRecord(id: string, input: Partial<RecordInput>) {
  const { data, error } = await supabase.from('billing_records').update(input).eq('id', id).select(RECORD_SELECT).maybeSingle()
  if (error) throw error
  if (!data) throw new BillingError(404, 'Billing record not found')
  return flattenRecord(data)
}

export async function markRecordPaid(id: string, paymentDate: string = new Date().toISOString().split('T')[0]) {
  return updateRecord(id, { payment_status: 'paid', payment_date: paymentDate })
}

export async function deleteRecord(id: string) {
  const { data, error } = await supabase.from('billing_records').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new BillingError(404, 'Billing record not found')
}
