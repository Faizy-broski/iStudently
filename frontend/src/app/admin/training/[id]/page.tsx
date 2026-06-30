'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ArrowLeft, Copy, Download, Edit2, Loader2, QrCode,
  ToggleLeft, ToggleRight, Trash2, UserX, ArrowUpCircle,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { useTrainingSession, useRegistrations } from '@/hooks/useTraining'
import {
  trainingApi, TrainingSession, CourseRegistration, TrainingPaymentStatus,
  CreateTrainingSessionDTO,
} from '@/lib/api/training'

// QR code is client-only
const QRCode = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })

function capacityColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-green-500'
}

const editSchema = z
  .object({
    title: z.string().min(2),
    description: z.string().optional(),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    total_seats: z.coerce.number().int().min(1),
    course_fee: z.coerce.number().min(0).optional(),
    target_audience: z.enum(['internal', 'external', 'both']),
    status: z.enum(['open', 'full', 'closed']),
  })
  .refine((d) => new Date(d.start_date) < new Date(d.end_date), {
    message: 'Start date must be before end date',
    path: ['end_date'],
  })
type EditFormData = z.infer<typeof editSchema>

const PAYMENT_OPTIONS: { value: TrainingPaymentStatus; label: string }[] = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'paid', label: 'Paid' },
  { value: 'expired', label: 'Expired' },
]

export default function TrainingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const { session, isLoading, mutate: mutateSession } = useTrainingSession(sessionId)
  const [activeTab, setActiveTab] = useState<string>('confirmed')
  const { registrations, isLoading: loadingRegs, mutate: mutateRegs } = useRegistrations(sessionId, {
    status: activeTab,
  })

  const [editOpen, setEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const copyLink = () => {
    if (!session) return
    navigator.clipboard.writeText(`${appUrl}/register/training/${session.public_token}`)
    toast.success('Registration link copied')
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await trainingApi.exportCSV(sessionId)
    } catch {
      toast.error('Export failed')
    }
    setIsExporting(false)
  }

  // Edit form
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    if (session && editOpen) {
      reset({
        title: session.title,
        description: session.description ?? '',
        start_date: session.start_date.slice(0, 16),
        end_date: session.end_date.slice(0, 16),
        total_seats: session.total_seats,
        course_fee: session.course_fee,
        target_audience: session.target_audience,
        status: session.status,
      })
    }
  }, [session, editOpen, reset])

  const onEditSubmit = async (data: EditFormData) => {
    setIsSaving(true)
    const res = await trainingApi.updateSession(sessionId, {
      ...data,
      start_date: new Date(data.start_date).toISOString(),
      end_date: new Date(data.end_date).toISOString(),
    } as Partial<CreateTrainingSessionDTO>)
    setIsSaving(false)
    if (res.success) {
      toast.success('Session updated')
      setEditOpen(false)
      mutateSession()
    } else {
      toast.error(res.error ?? 'Update failed')
    }
  }

  // Registration actions
  const toggleAttendance = async (reg: CourseRegistration) => {
    const res = await trainingApi.toggleAttendance(reg.id, sessionId)
    if (res.success) {
      mutateRegs()
    } else {
      toast.error('Failed to update attendance')
    }
  }

  const updatePayment = async (reg: CourseRegistration, status: TrainingPaymentStatus) => {
    const res = await trainingApi.updatePaymentStatus(reg.id, sessionId, status)
    if (res.success) {
      mutateRegs()
    } else {
      toast.error('Failed to update payment status')
    }
  }

  const cancelReg = async (reg: CourseRegistration) => {
    const res = await trainingApi.cancelRegistration(reg.id, sessionId)
    if (res.success) {
      toast.success('Registration cancelled')
      mutateRegs()
      mutateSession()
    } else {
      toast.error(res.error ?? 'Failed to cancel')
    }
  }

  const promoteReg = async (reg: CourseRegistration) => {
    const res = await trainingApi.promoteWaitlistRecord(reg.id, sessionId)
    if (res.success) {
      toast.success('Registration promoted to confirmed')
      mutateRegs()
      mutateSession()
    } else if ((res as any).status === 409 || res.error?.includes('already filled')) {
      toast.error('Seat already filled by another action')
    } else {
      toast.error(res.error ?? 'Failed to promote')
    }
  }

  const hardDelete = async (reg: CourseRegistration) => {
    const res = await trainingApi.hardDeleteRegistration(reg.id, sessionId)
    if (res.success || (res as any).status === 204) {
      toast.success('Registration permanently deleted')
      mutateRegs()
      mutateSession()
    } else {
      toast.error(res.error ?? 'Failed to delete')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Session not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push('/admin/training')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Training
        </Button>
      </div>
    )
  }

  const pct = session.total_seats > 0
    ? Math.round((session.registered_seats / session.total_seats) * 100)
    : 0

  const counts = session.registration_counts ?? { confirmed: 0, waiting_list: 0, cancelled: 0 }

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/training')} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{session.title}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                session.status === 'open' ? 'bg-green-100 text-green-800'
                : session.status === 'full' ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-700'
              }`}>
                {session.status}
              </span>
              <Badge variant="outline" className="text-xs">{session.target_audience}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(session.start_date), 'MMM d, yyyy h:mm a')} –{' '}
              {format(new Date(session.end_date), 'MMM d, yyyy h:mm a')}
              {session.course_fee > 0 && ` · Fee: ${session.course_fee.toFixed(2)}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1" /> Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
              {isExporting
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Download className="h-4 w-4 mr-1" />}
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Capacity */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {session.registered_seats} of {session.total_seats} seats taken
            </span>
            <span className="text-muted-foreground">{session.available_seats} remaining</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${capacityColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground pt-1">
            <span>Confirmed: {counts.confirmed}</span>
            <span>Waitlisted: {counts.waiting_list}</span>
            <span>Cancelled: {counts.cancelled}</span>
          </div>
        </CardContent>
      </Card>

      {/* Registrations Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="confirmed">Confirmed ({counts.confirmed})</TabsTrigger>
          <TabsTrigger value="waiting_list">Waitlist ({counts.waiting_list})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({counts.cancelled})</TabsTrigger>
        </TabsList>

        {(['confirmed', 'waiting_list', 'cancelled'] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            {loadingRegs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No {tab.replace('_', ' ')} registrations
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((reg) => (
                      <TableRow key={reg.id}>
                        <TableCell className="font-medium">{reg.display_name ?? '—'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            reg.student_type === 'internal'
                              ? 'bg-blue-600 text-white'
                              : 'bg-orange-500 text-white'
                          }`}>
                            {reg.student_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {reg.ext_parent_phone ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={reg.payment_status}
                            onValueChange={(v) => updatePayment(reg, v as TrainingPaymentStatus)}
                          >
                            <SelectTrigger className="h-7 text-xs w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {/* Proper toggle switch */}
                          <button
                            onClick={() => toggleAttendance(reg)}
                            title={reg.attendance_status ? 'Mark absent' : 'Mark present'}
                            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                              reg.attendance_status ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                                reg.attendance_status ? 'translate-x-7' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </TableCell>
                        <TableCell>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 w-9 p-0 border-dashed hover:border-solid hover:bg-primary/10"
                                title="View QR code"
                              >
                                <QrCode className="h-5 w-5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-4">
                              <QRCode value={reg.qr_auth_token} size={160} />
                              <p className="text-xs text-muted-foreground mt-2 font-mono truncate max-w-40 text-center">
                                {reg.qr_auth_token.slice(0, 12)}…
                              </p>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(reg.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {tab === 'waiting_list' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => promoteReg(reg)}
                                title="Promote to Confirmed"
                              >
                                <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
                                Promote
                              </Button>
                            )}
                            {tab !== 'cancelled' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => cancelReg(reg)}
                                title="Cancel registration"
                              >
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:text-destructive"
                                  title="Permanently delete PII"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Permanently Delete Registration?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently removes all personal data for{' '}
                                    <strong>{reg.display_name}</strong> from the database. This cannot
                                    be undone and is intended for PII erasure requests.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    onClick={() => hardDelete(reg)}
                                  >
                                    Delete Permanently
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} {...register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="datetime-local" {...register('start_date')} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="datetime-local" {...register('end_date')} />
                {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Seats</Label>
                <Input type="number" min={1} {...register('total_seats')} />
                {errors.total_seats && <p className="text-xs text-destructive">{errors.total_seats.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Fee</Label>
                <Input type="number" min={0} step="0.01" {...register('course_fee')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                defaultValue={session.status}
                onValueChange={(v) => setValue('status', v as EditFormData['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
