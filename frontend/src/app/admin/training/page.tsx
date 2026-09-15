'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Plus, ClipboardList, Copy, Trash2, Eye, Users, BookOpen, CheckCircle, Edit, Sparkles, Award } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateWithPreference } from '@/lib/utils/dateFormat'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { useTrainingSessions } from '@/hooks/useTraining'
import { trainingApi, TrainingSession } from '@/lib/api/training'
import { useCampus } from '@/context/CampusContext'
import { TrainingSessionFormModal } from '@/components/admin/training/TrainingSessionFormModal'

function capacityColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-green-500'
}

function StatusBadge({ status }: { status: TrainingSession['status'] }) {
  const t = useTranslations('adminTrainingSessions')
  const map: Record<string, string> = {
    open: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
    full: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }
  const labels: Record<string, string> = {
    open: t('statusOpen'),
    full: t('statusFull'),
    closed: t('statusClosed'),
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  )
}

export default function TrainingPage() {
  const t = useTranslations('adminTrainingSessions')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const router = useRouter()
  const { sessions, isLoading, mutate } = useTrainingSessions()
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sessionToEdit, setSessionToEdit] = useState<TrainingSession | null>(null)

  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? ''

  const copyLink = (token: string) => {
    const url = `${appUrl}/register/training/${token}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast.success(t('linkCopied')))
        .catch(() => fallbackCopy(url))
    } else {
      fallbackCopy(url)
    }
  }

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    try {
      document.execCommand('copy')
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('copyFailedManual', { url: text }))
    }
    document.body.removeChild(el)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const res = await trainingApi.deleteSession(id, campusId)
    setDeletingId(null)
    if (res.success || (res as any).status === 204) {
      toast.success(t('sessionDeleted'))
      mutate()
    } else {
      toast.error(res.error ?? t('failedDeleteSession'))
    }
  }

  const handleOpenCreate = () => {
    setSessionToEdit(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (s: TrainingSession) => {
    setSessionToEdit(s)
    setIsModalOpen(true)
  }

  // Stats
  const totalRegistrations = sessions.reduce((n, s) => n + s.registered_seats, 0)
  const open = sessions.filter((s) => s.status === 'open').length
  const full = sessions.filter((s) => s.status === 'full').length

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* System Standard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white dark:bg-gradient-to-r dark:from-[#57A3CC] dark:to-white">
            {t('pageTitle')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {t('pageSubtitle')}
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white shadow-sm gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('newSessionSpec')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('statTotalSessions'), value: sessions.length, icon: ClipboardList },
          { label: t('statOpen'), value: open, icon: BookOpen },
          { label: t('statFull'), value: full, icon: CheckCircle },
          { label: t('statTotalRegistrations'), value: totalRegistrations, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="shadow-sm border-border bg-card">
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#022172] dark:text-[#57A3CC]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 h-28" />
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="shadow-sm border-border">
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center gap-3">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-lg">{t('noSessionsYet')}</p>
            <p className="text-muted-foreground text-sm">
              {t('noSessionsDesc')}
            </p>
            <Button onClick={handleOpenCreate} className="mt-2 bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white">
              <Plus className="mr-2 h-4 w-4" />
              {t('createSessionSpec')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const pct = session.total_seats > 0
              ? Math.round((session.registered_seats / session.total_seats) * 100)
              : 0

            return (
              <Card key={session.id} className="shadow-sm border-border bg-card">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Cover thumbnail if available */}
                    {session.cover_image_url && (
                      <img
                        src={session.cover_image_url}
                        alt="Banner"
                        className="w-24 h-24 object-cover rounded-lg border border-border shrink-0"
                      />
                    )}

                    {/* Info */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-foreground">{session.title}</h3>
                        <StatusBadge status={session.status} />
                        {session.category && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-200">
                            {session.category}
                          </Badge>
                        )}
                        {session.skill_level && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {session.skill_level}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {t('audienceSuffix', { audience: session.target_audience })}
                        </Badge>
                        {session.certificate_settings?.enable_auto_issuance && (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 gap-1">
                            <Award className="h-3 w-3" /> {t('autoCert')}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {formatDateWithPreference(session.start_date)} – {formatDateWithPreference(session.end_date)}
                        {session.daily_time_range ? ` • ${session.daily_time_range}` : ''}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-0.5">
                        {session.instructor_name && (
                          <span>{t('instructor')} <strong>{session.instructor_name}</strong></span>
                        )}
                        {session.location_venue_link && (
                          <span>{t('venueLink')} <strong>{session.location_venue_link}</strong></span>
                        )}
                        <span>{t('fee')} <strong>{session.course_fee > 0 ? t('feeCurrency', { amount: session.course_fee }) : t('free')}</strong></span>
                      </div>

                      {/* Capacity bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {t('seatsTaken', { registered: session.registered_seats, total: session.total_seats })}
                          </span>
                          <span>{t('seatsRemaining', { count: session.available_seats })}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${capacityColor(pct)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/training/${session.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          {t('view')}
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(session)}
                        className="text-[#022172] dark:text-[#57A3CC]"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        {t('editSpec')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(session.public_token)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        {t('copyLink')}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('deleteSessionTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('deleteSessionDesc', { title: session.title, count: session.registered_seats })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => handleDelete(session.id)}
                            >
                              {deletingId === session.id ? t('deleting') : t('delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Complete Training Session & Certificate Builder Modal */}
      <TrainingSessionFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sessionToEdit={sessionToEdit}
        onSaved={() => mutate()}
      />
    </div>
  )
}
