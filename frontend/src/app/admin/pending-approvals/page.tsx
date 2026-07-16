'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Check, X, RefreshCw, Search, Filter, UserCheck, Database, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getPendingSignups,
  approvePendingSignup,
  rejectPendingSignup,
  type PendingSignup,
} from '@/lib/api/pending-signups'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { arSA, enUS } from 'date-fns/locale'
import { useCampus } from '@/context/CampusContext'

const ROLE_COLORS: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-800',
  student: 'bg-green-100 text-green-800',
  parent: 'bg-purple-100 text-purple-800',
  staff: 'bg-orange-100 text-orange-800',
  librarian: 'bg-teal-100 text-teal-800',
  counselor: 'bg-pink-100 text-pink-800',
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function Initials({ name }: { name: string }) {
  const parts = name.split(' ')
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2)
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center text-white font-semibold text-sm shrink-0 uppercase">
      {initials}
    </div>
  )
}

export default function PendingApprovalsPage() {
  const t = useTranslations('pendingApprovals')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const dateFnsLocale = isAr ? arSA : enUS
  const campusContext = useCampus()
  const selectedCampusId = campusContext?.selectedCampus?.id

  type TabStatus = 'all' | 'pending' | 'approved' | 'rejected'
  const [activeTab, setActiveTab] = React.useState<TabStatus>('pending')
  const [signups, setSignups] = React.useState<PendingSignup[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState('all')

  // Detail view
  const [detailItem, setDetailItem] = React.useState<PendingSignup | null>(null)

  // Reject dialog
  const [rejectTarget, setRejectTarget] = React.useState<PendingSignup | null>(null)
  const [rejectReason, setRejectReason] = React.useState('')
  const [rejecting, setRejecting] = React.useState(false)

  // Approve dialog
  const [approveTarget, setApproveTarget] = React.useState<PendingSignup | null>(null)
  const [approving, setApproving] = React.useState(false)

  const fetchSignups = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPendingSignups({
        status: activeTab === 'all' ? undefined : activeTab,
        role: roleFilter === 'all' ? undefined : roleFilter,
        search: search.trim() || undefined,
        campus_id: selectedCampusId || undefined,
      })
      if (res.success) {
        setSignups(res.data ?? [])
        setTotal((res as any).total ?? res.data?.length ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab, roleFilter, search, selectedCampusId])

  React.useEffect(() => { fetchSignups() }, [fetchSignups])

  const handleApprove = async () => {
    if (!approveTarget) return
    setApproving(true)
    try {
      const res = await approvePendingSignup(approveTarget.id)
      if (res.success) {
        toast.success(t('approvedToast', { name: `${approveTarget.first_name} ${approveTarget.last_name}` }))
        setApproveTarget(null)
        setDetailItem(null)
        fetchSignups()
      } else {
        toast.error(res.error ?? 'Failed to approve')
      }
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      const res = await rejectPendingSignup(rejectTarget.id, rejectReason || undefined)
      if (res.success) {
        toast.success(t('rejectedToast', { name: `${rejectTarget.first_name} ${rejectTarget.last_name}` }))
        setRejectTarget(null)
        setRejectReason('')
        setDetailItem(null)
        fetchSignups()
      } else {
        toast.error(res.error ?? 'Failed to reject')
      }
    } finally {
      setRejecting(false)
    }
  }

  const tabs: { key: TabStatus; label: string }[] = [
    { key: 'all', label: t('tabAll') },
    { key: 'pending', label: t('tabPending') },
    { key: 'approved', label: t('tabApproved') },
    { key: 'rejected', label: t('tabRejected') },
  ]

  const pendingCount = signups.filter(s => s.status === 'pending').length

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            {t('pageTitle')}
          </h1>
          {pendingCount > 0 && activeTab !== 'pending' && (
            <Badge className="bg-red-500 text-white text-xs">{pendingCount}</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchSignups} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-[#022172] text-[#022172]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterRole')}</SelectItem>
            {['teacher', 'student', 'parent', 'staff', 'librarian'].map(r => (
              <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : signups.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">{t('emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('emptyDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {signups.map((signup) => (
            <Card
              key={signup.id}
              className="border border-gray-200 hover:border-[#57A3CC] transition-all cursor-pointer"
              onClick={() => setDetailItem(signup)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Initials name={`${signup.first_name} ${signup.last_name}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {signup.first_name} {signup.last_name}
                      </span>
                      <Badge className={cn('text-xs', ROLE_COLORS[signup.role] ?? 'bg-gray-100 text-gray-700')}>
                        {signup.role}
                      </Badge>
                      <Badge className={cn('text-xs', STATUS_COLORS[signup.status])}>
                        {t(`status${signup.status.charAt(0).toUpperCase() + signup.status.slice(1)}` as any)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{signup.email}</p>
                    {signup.phone && <p className="text-xs text-muted-foreground">{signup.phone}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        {t('requestedAgo', {
                          time: formatDistanceToNow(parseISO(signup.created_at), { locale: dateFnsLocale })
                        })}
                      </span>
                      {signup.link_label && (
                        <span>{t('viaLink', { label: signup.link_label })}</span>
                      )}
                    </div>
                  </div>

                  {/* Quick actions for pending items */}
                  {signup.status === 'pending' && (
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="h-8 bg-green-500 hover:bg-green-600 text-white border-0 gap-1"
                        onClick={() => setApproveTarget(signup)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline text-xs">{t('approve')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-red-600 border-red-300 hover:bg-red-50 gap-1"
                        onClick={() => { setRejectTarget(signup); setRejectReason('') }}
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline text-xs">{t('reject')}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <Dialog open={!!detailItem} onOpenChange={(o) => { if (!o) setDetailItem(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Initials name={`${detailItem.first_name} ${detailItem.last_name}`} />
                  <div>
                    <div className="font-semibold">{detailItem.first_name} {detailItem.last_name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{detailItem.email}</div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{isAr ? 'الدور' : 'Role'}</p>
                    <Badge className={cn('text-xs mt-0.5', ROLE_COLORS[detailItem.role] ?? '')}>{detailItem.role}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{isAr ? 'الحالة' : 'Status'}</p>
                    <Badge className={cn('text-xs mt-0.5', STATUS_COLORS[detailItem.status])}>
                      {t(`status${detailItem.status.charAt(0).toUpperCase() + detailItem.status.slice(1)}` as any)}
                    </Badge>
                  </div>
                  {detailItem.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground">{isAr ? 'الهاتف' : 'Phone'}</p>
                      <p className="font-medium">{detailItem.phone}</p>
                    </div>
                  )}
                  {detailItem.link_label && (
                    <div>
                      <p className="text-xs text-muted-foreground">{isAr ? 'عبر رابط' : 'Via Link'}</p>
                      <p className="font-medium">{detailItem.link_label}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">{isAr ? 'تاريخ الطلب' : 'Requested'}</p>
                    <p className="font-medium">{new Date(detailItem.created_at).toLocaleString()}</p>
                  </div>
                  {detailItem.status !== 'pending' && detailItem.reviewer_name && (
                    <div className="col-span-2 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        {t('reviewedBy', { name: detailItem.reviewer_name })}
                        {detailItem.reviewed_at && ` ${t('reviewedAt', { date: new Date(detailItem.reviewed_at).toLocaleDateString() })}`}
                      </p>
                      {detailItem.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">{isAr ? 'السبب: ' : 'Reason: '}{detailItem.rejection_reason}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Extra data submitted by applicant ── */}
                {(() => {
                  const extraEntries = Object.entries(detailItem.extra_data ?? {}).filter(
                    ([key]) => key !== '__grade_level_id__'
                  )
                  if (extraEntries.length === 0) return null

                  // Build a label map from link_meta
                  const fieldDefs = detailItem.link_meta?.custom_fields ?? []
                  const defMap = new Map(fieldDefs.map(f => [f.id, f]))

                  return (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {isAr ? 'المعلومات المُقدَّمة' : 'Submitted Information'}
                      </p>
                      <div className="rounded-xl border dark:border-slate-700 divide-y dark:divide-slate-700 overflow-hidden">
                        {extraEntries.map(([key, value]) => {
                          const def = defMap.get(key)
                          const label = def?.label ?? key
                          const isProfileField = def?.source === 'profile_field'
                          const displayValue = Array.isArray(value)
                            ? value.join(', ')
                            : (value == null || value === '')
                              ? <span className="italic text-muted-foreground">{isAr ? '(فارغ)' : '(empty)'}</span>
                              : String(value)
                          return (
                            <div key={key} className="flex items-start justify-between gap-3 px-3 py-2.5 bg-white dark:bg-slate-900/60">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                                  {isProfileField ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                                      <Database className="h-2.5 w-2.5" />
                                      {isAr ? 'حقل الملف الشخصي' : 'Profile Field'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                                      <Tag className="h-2.5 w-2.5" />
                                      {isAr ? 'مخصص' : 'Custom'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 break-words">{displayValue}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
              {detailItem.status === 'pending' && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => { setDetailItem(null); setRejectTarget(detailItem); setRejectReason('') }}
                  >
                    <X className="h-4 w-4 me-1" /> {t('reject')}
                  </Button>
                  <Button
                    className="bg-green-500 hover:bg-green-600 text-white border-0"
                    onClick={() => { setDetailItem(null); setApproveTarget(detailItem) }}
                  >
                    <Check className="h-4 w-4 me-1" /> {t('approve')}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirm Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => { if (!o) setApproveTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('approveConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {approveTarget && t('approveConfirmDesc', {
                name: `${approveTarget.first_name} ${approveTarget.last_name}`,
                role: approveTarget.role,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white border-0"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? (isAr ? 'جارٍ الموافقة...' : 'Approving...') : t('approveConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason('') } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('rejectDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="reject-reason">{t('rejectReasonLabel')}</Label>
            <Textarea
              id="reject-reason"
              placeholder={t('rejectReasonPlaceholder')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason('') }}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? (isAr ? 'جارٍ الرفض...' : 'Rejecting...') : t('rejectConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
