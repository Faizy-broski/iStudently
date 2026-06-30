'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Printer, ImageDown, AlertTriangle, CheckCircle2, Clock,
  Users, Loader2, CalendarDays, DollarSign, Search, Ticket,
  GraduationCap, UserPlus, MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { publicTrainingApi, PublicTrainingSession, RegisterDTO } from '@/lib/api/training'

// QRCodeCanvas (not SVG) so html2canvas can capture it correctly
const QRCodeCanvas = dynamic(() => import('qrcode.react').then((m) => m.QRCodeCanvas), { ssr: false })

// ─── Schemas ─────────────────────────────────────────────────────────────────

const internalSchema = z.object({
  student_number: z.string().min(1, 'Student number is required'),
})
const externalSchema = z.object({
  ext_student_name: z.string().min(2, 'Full name is required'),
  ext_student_age: z.coerce.number().int().min(1, 'Age is required').max(100),
  ext_parent_phone: z.string().min(5, 'Parent phone is required'),
  ext_current_school: z.string().optional(),
})
const waitlistSchema = z.object({
  ext_student_name: z.string().min(2, 'Full name is required'),
  ext_parent_phone: z.string().min(5, 'Parent phone is required'),
})

type InternalForm = z.infer<typeof internalSchema>
type ExternalForm = z.infer<typeof externalSchema>
type WaitlistForm = z.infer<typeof waitlistSchema>

// ─── Capacity Bar ────────────────────────────────────────────────────────────

function CapacityBar({ session }: { session: PublicTrainingSession }) {
  const pct = session.total_seats > 0
    ? Math.round((session.registered_seats / session.total_seats) * 100)
    : 0
  const color = pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-400' : 'bg-emerald-500'
  const textColor = pct >= 80 ? 'text-red-600' : pct >= 50 ? 'text-amber-600' : 'text-emerald-600'
  const bgColor = pct >= 80 ? 'bg-red-50 border-red-100' : pct >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'

  return (
    <div className={`rounded-xl border p-4 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className={`h-4 w-4 ${textColor}`} />
          <span className={`text-sm font-semibold ${textColor}`}>
            {session.available_seats > 0
              ? `${session.available_seats} seat${session.available_seats !== 1 ? 's' : ''} remaining`
              : 'Session Full'}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-medium">
          {session.registered_seats}/{session.total_seats} registered
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/70 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Success Card ─────────────────────────────────────────────────────────────

function SuccessCard({
  qrAuthToken, registrationStatus, sessionTitle,
}: {
  qrAuthToken: string
  registrationStatus: string
  sessionTitle: string
}) {
  const printAreaRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const isConfirmed = registrationStatus === 'confirmed'

  // Inject print CSS that correctly isolates #print-area using visibility (not display)
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'ticket-print-style'
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #print-area, #print-area * { visibility: visible !important; }
        #print-area {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: white !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById('ticket-print-style')?.remove() }
  }, [])

  const saveAsImage = () => {
    // html2canvas fails on Tailwind v4 lab()/oklch() colors.
    // Instead draw the ticket directly onto a Canvas using the native 2D API.
    const qrCanvas = printAreaRef.current?.querySelector('canvas')
    if (!qrCanvas) {
      toast.error('QR code not ready yet — please wait a moment and try again.')
      return
    }

    setSaving(true)
    try {
      const DPR = 2          // retina
      const W = 400
      const PAD = 32
      const QR = 200
      const H = PAD + 36 + 12 + 14 + 10 + 18 + 16 + (QR + 24) + 18 + 14 + PAD

      const canvas = document.createElement('canvas')
      canvas.width = W * DPR
      canvas.height = H * DPR
      const ctx = canvas.getContext('2d')!
      ctx.scale(DPR, DPR)

      // helpers
      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }

      // Background
      ctx.fillStyle = '#f0fdf4'
      roundRect(0, 0, W, H, 20)
      ctx.fill()

      let y = PAD

      // ── Status badge ──────────────────────────────────────────
      const badgeW = 210
      const badgeH = 30
      ctx.fillStyle = '#d1fae5'
      roundRect((W - badgeW) / 2, y, badgeW, badgeH, 15)
      ctx.fill()
      ctx.fillStyle = '#065f46'
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('✓  Registration Confirmed', W / 2, y + badgeH / 2)
      y += badgeH + 20

      // ── "SESSION" label ───────────────────────────────────────
      ctx.fillStyle = '#9ca3af'
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.letterSpacing = '0.1em'
      ctx.fillText('SESSION', W / 2, y)
      y += 18

      // ── Session title ─────────────────────────────────────────
      ctx.fillStyle = '#111827'
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.letterSpacing = '0'
      ctx.fillText(sessionTitle, W / 2, y)
      y += 24

      // ── QR white card ─────────────────────────────────────────
      const qrX = (W - QR) / 2
      ctx.shadowColor = 'rgba(0,0,0,0.08)'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#ffffff'
      roundRect(qrX - 16, y - 16, QR + 32, QR + 32, 14)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.drawImage(qrCanvas, qrX, y, QR, QR)
      y += QR + 24

      // ── Token snippet ─────────────────────────────────────────
      ctx.fillStyle = '#9ca3af'
      ctx.font = '10px "Courier New", monospace'
      ctx.fillText(`${qrAuthToken.slice(0, 16)}…`, W / 2, y)
      y += 18

      // ── Footer note ───────────────────────────────────────────
      ctx.fillStyle = '#6b7280'
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText('Present this QR code at the entrance', W / 2, y)

      // ── Download ──────────────────────────────────────────────
      const link = document.createElement('a')
      link.download = `ticket-${qrAuthToken.slice(0, 8)}.png`
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('[SaveAsImage]', err)
      toast.error('Failed to save image.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {isConfirmed && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <span>
            <strong>Save your ticket now</strong> — this QR code won&apos;t be retrievable later without contacting the school.
          </span>
        </div>
      )}

      <div
        ref={printAreaRef}
        id="print-area"
        className={`relative overflow-hidden rounded-2xl border shadow-lg ${
          isConfirmed
            ? 'bg-linear-to-br from-white to-emerald-50 border-emerald-100'
            : 'bg-linear-to-br from-white to-amber-50 border-amber-100'
        }`}
      >
        <div className="relative p-8 flex flex-col items-center gap-5 text-center">
          {/* Status badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${
            isConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isConfirmed
              ? <><CheckCircle2 className="h-4 w-4" /> Registration Confirmed</>
              : <><Clock className="h-4 w-4" /> Added to Waitlist</>
            }
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Session</p>
            <p className="font-bold text-gray-800 text-lg leading-snug">{sessionTitle}</p>
          </div>

          {isConfirmed ? (
            <>
              {/* QRCodeCanvas — renders to <canvas>, captured correctly by html2canvas */}
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
                <QRCodeCanvas value={qrAuthToken} size={180} />
              </div>
              <div>
                <p className="text-[11px] font-mono text-gray-400 tracking-wide">
                  {qrAuthToken.slice(0, 16)}…
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Present this QR code at the entrance
                </p>
              </div>

              <div className="w-full flex items-center gap-3">
                <div className="flex-1 border-t border-dashed border-gray-200" />
                <Ticket className="h-4 w-4 text-gray-300" />
                <div className="flex-1 border-t border-dashed border-gray-200" />
              </div>
            </>
          ) : (
            <div className="max-w-xs">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-gray-600 text-sm leading-relaxed">
                You&apos;re on the waitlist. If a seat becomes available, the school will contact you directly.
              </p>
            </div>
          )}
        </div>
      </div>

      {isConfirmed && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-gray-200 hover:bg-gray-50"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Ticket
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-gray-200 hover:bg-gray-50"
            onClick={saveAsImage}
            disabled={saving}
          >
            {saving
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <ImageDown className="mr-2 h-4 w-4" />}
            Save as Image
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#000000' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const inputCls = [
  "w-full h-11 px-3 rounded-lg text-sm text-gray-900 bg-white",
  "border border-gray-300",
  "placeholder:text-gray-400",
  "outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
  "transition-colors",
].join(' ')

// Plain <input> bypasses Shadcn styles entirely for guaranteed text visibility
function RawInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputCls} ${className}`} {...props} />
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrainingRegisterPage() {
  const params = useParams()
  const token = params.token as string

  const [pageState, setPageState] = useState<'form' | 'success'>('form')
  const [result, setResult] = useState<{ qr_auth_token: string; registration_status: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lookedUpStudent, setLookedUpStudent] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  const { data: session, isLoading, error } = useSWR(
    token ? `public-training-${token}` : null,
    () => publicTrainingApi.getSession(token),
    { refreshInterval: 30000, revalidateOnFocus: false }
  )

  const internalForm = useForm<InternalForm>({ resolver: zodResolver(internalSchema) })
  const externalForm = useForm<ExternalForm>({ resolver: zodResolver(externalSchema) })
  const waitlistForm = useForm<WaitlistForm>({ resolver: zodResolver(waitlistSchema) })

  const lookupStudent = async () => {
    const studentNumber = internalForm.getValues('student_number')
    if (!studentNumber) return
    setLookingUp(true)
    setLookedUpStudent(null)
    try {
      const student = await publicTrainingApi.lookupStudent(token, studentNumber)
      setLookedUpStudent(student)
    } catch {
      toast.error('Student not found. Please check the ID and try again.')
    }
    setLookingUp(false)
  }

  const submitRegistration = async (dto: RegisterDTO) => {
    setIsSubmitting(true)
    try {
      const data = await publicTrainingApi.register(token, dto)
      setResult(data)
      setPageState('success')
    } catch (err: any) {
      toast.error(err.message ?? 'Registration failed. Please try again.')
    }
    setIsSubmitting(false)
  }

  const onInternalSubmit = () => {
    if (!lookedUpStudent) { toast.error('Please look up your Student ID first'); return }
    submitRegistration({ student_type: 'internal', student_id: lookedUpStudent.id })
  }

  const onExternalSubmit = (data: ExternalForm) => {
    submitRegistration({
      student_type: 'external',
      ext_student_name: data.ext_student_name,
      ext_student_age: data.ext_student_age,
      ext_parent_phone: data.ext_parent_phone,
      ext_current_school: data.ext_current_school || undefined,
    })
  }

  const onWaitlistSubmit = (data: WaitlistForm) => {
    submitRegistration({
      student_type: 'external',
      ext_student_name: data.ext_student_name,
      ext_parent_phone: data.ext_parent_phone,
    })
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
          <p className="text-sm text-gray-500">Loading session info…</p>
        </div>
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-red-50 via-white to-orange-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-lg">Link Not Found</p>
            <p className="text-sm text-gray-500 mt-1">
              This registration link is invalid or has expired. Please contact the school for a new link.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Closed ───────────────────────────────────────────────────────────────

  if (session.status === 'closed') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-gray-50 via-white to-slate-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Users className="h-7 w-7 text-gray-400" />
          </div>
          <div>
            <p className="font-bold text-gray-800 text-lg">Registration Closed</p>
            <p className="text-sm text-gray-500 mt-1">
              Registration for this session is no longer open.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isFull = session.status === 'full'

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-violet-50">
      {/* Hero Header */}
      <div className="bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 text-white">
        <div className="max-w-lg mx-auto px-4 pt-12 pb-16">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium mb-4">
            <GraduationCap className="h-3.5 w-3.5" />
            Training Session Registration
          </div>
          <h1 className="text-3xl font-extrabold leading-tight mb-2 drop-shadow-sm">
            {session.title}
          </h1>
          {session.description && (
            <p className="text-indigo-100 text-sm leading-relaxed">
              {session.description}
            </p>
          )}

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-medium">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(session.start_date), 'MMM d')} – {format(new Date(session.end_date), 'MMM d, yyyy')}
            </div>
            {session.course_fee > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <DollarSign className="h-3.5 w-3.5" />
                Fee: {session.course_fee.toFixed(2)}
              </div>
            )}
            {session.course_fee === 0 && (
              <div className="inline-flex items-center gap-1.5 bg-emerald-400/30 rounded-full px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Free Entry
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content — overlaps hero */}
      <div className="max-w-lg mx-auto px-4 -mt-8 pb-16 space-y-4">

        {/* Capacity card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <CapacityBar session={session} />
        </div>

        {/* Waitlist banner */}
        {isFull && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold">This session is full</p>
              <p className="text-amber-700 text-xs mt-0.5">You can join the waitlist below — you&apos;ll be notified if a seat opens up.</p>
            </div>
          </div>
        )}

        {/* Success State */}
        {pageState === 'success' && result && (
          <SuccessCard
            qrAuthToken={result.qr_auth_token}
            registrationStatus={result.registration_status}
            sessionTitle={session.title}
          />
        )}

        {/* Registration Form */}
        {pageState === 'form' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Form header */}
            <div className="px-6 py-5 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  {isFull
                    ? <Clock className="h-5 w-5 text-amber-500" />
                    : <UserPlus className="h-5 w-5 text-indigo-600" />
                  }
                </div>
                <div>
                  <h2 className="font-bold text-black">
                    {isFull ? 'Join the Waitlist' : 'Register Now'}
                  </h2>
                  <p className="text-xs text-black/60">
                    {isFull ? 'We\'ll contact you when a seat opens' : 'Secure your spot today'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {isFull ? (
                /* Waitlist form */
                <form onSubmit={waitlistForm.handleSubmit(onWaitlistSubmit)} className="space-y-4">
                  <Field label="Full Name *" error={waitlistForm.formState.errors.ext_student_name?.message}>
                    <RawInput
                      placeholder="Enter your full name"
                      {...waitlistForm.register('ext_student_name')}
                    />
                  </Field>
                  <Field label="Parent / Guardian Phone *" error={waitlistForm.formState.errors.ext_parent_phone?.message}>
                    <RawInput
                      type="tel"
                      placeholder="+966 5xx xxx xxxx"
                      {...waitlistForm.register('ext_parent_phone')}
                    />
                  </Field>
                  <Button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl h-11 shadow-sm shadow-amber-200"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Join Waitlist
                  </Button>
                </form>
              ) : (
                /* Normal form with tabs */
                <Tabs defaultValue={session.target_audience === 'external' ? 'external' : 'internal'}>
                  {session.target_audience === 'both' && (
                    <TabsList className="w-full mb-5 bg-gray-100 rounded-xl p-1 h-auto">
                      <TabsTrigger
                        value="internal"
                        className="flex-1 rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm py-2"
                      >
                        <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                        Current Student
                      </TabsTrigger>
                      <TabsTrigger
                        value="external"
                        className="flex-1 rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm py-2"
                      >
                        <MapPin className="h-3.5 w-3.5 mr-1.5" />
                        New / External
                      </TabsTrigger>
                    </TabsList>
                  )}

                  {/* Internal Tab */}
                  {session.target_audience !== 'external' && (
                    <TabsContent value="internal" className="mt-0">
                      <form onSubmit={internalForm.handleSubmit(onInternalSubmit)} className="space-y-4">
                        <Field label="Student ID / Number *" error={internalForm.formState.errors.student_number?.message}>
                          <div className="flex gap-2">
                            <RawInput
                              placeholder="e.g. STD-2024-001"
                              {...internalForm.register('student_number')}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 shrink-0"
                              onClick={lookupStudent}
                              disabled={lookingUp}
                            >
                              {lookingUp
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <><Search className="h-4 w-4 mr-1" /> Look Up</>
                              }
                            </Button>
                          </div>
                        </Field>

                        {lookedUpStudent && (
                          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-xs text-emerald-600 font-medium">Student found</p>
                              <p className="text-sm font-bold text-emerald-800">
                                {lookedUpStudent.first_name} {lookedUpStudent.last_name}
                              </p>
                            </div>
                          </div>
                        )}

                        <Button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-xl h-11 shadow-sm shadow-indigo-200"
                          disabled={isSubmitting || !lookedUpStudent}
                        >
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirm Registration
                        </Button>
                      </form>
                    </TabsContent>
                  )}

                  {/* External Tab */}
                  {session.target_audience !== 'internal' && (
                    <TabsContent value="external" className="mt-0">
                      <form onSubmit={externalForm.handleSubmit(onExternalSubmit)} className="space-y-4">
                        <Field label="Full Name *" error={externalForm.formState.errors.ext_student_name?.message}>
                          <RawInput
                            placeholder="Student full name"
                            {...externalForm.register('ext_student_name')}
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Age *" error={externalForm.formState.errors.ext_student_age?.message}>
                            <RawInput
                              type="number"
                              min={1}
                              max={100}
                              placeholder="e.g. 12"
                              {...externalForm.register('ext_student_age')}
                            />
                          </Field>
                          <Field label="Parent Phone *" error={externalForm.formState.errors.ext_parent_phone?.message}>
                            <RawInput
                              type="tel"
                              placeholder="+966 5xx xxx xxxx"
                              {...externalForm.register('ext_parent_phone')}
                            />
                          </Field>
                        </div>
                        <Field label="Current School">
                          <RawInput
                            placeholder="Optional"
                            {...externalForm.register('ext_current_school')}
                          />
                        </Field>

                        <Button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-xl h-11 shadow-sm shadow-indigo-200"
                          disabled={isSubmitting}
                        >
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Register Now
                        </Button>
                      </form>
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 pb-2">
          By registering you agree to the school&apos;s terms and conditions.
        </p>
      </div>
    </div>
  )
}
