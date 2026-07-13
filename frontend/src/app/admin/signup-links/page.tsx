'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Link2, Copy, Check, Trash2, Power, PowerOff, Share2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCampus } from '@/context/CampusContext'
import {
  getSignupLinks,
  deactivateSignupLink,
  activateSignupLink,
  deleteSignupLink,
  buildSignupUrl,
  type SignupLink,
} from '@/lib/api/signup-links'
import { getPendingCount } from '@/lib/api/pending-signups'
import { formatDistanceToNow, parseISO } from 'date-fns'



const ROLE_COLORS: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-800',
  student: 'bg-green-100 text-green-800',
  parent: 'bg-purple-100 text-purple-800',
  staff: 'bg-orange-100 text-orange-800',
  librarian: 'bg-teal-100 text-teal-800',
  counselor: 'bg-pink-100 text-pink-800',
}

function getLinkStatus(link: SignupLink): 'active' | 'inactive' | 'expired' {
  if (!link.is_active) return 'inactive'
  if (link.expires_at && new Date(link.expires_at) < new Date()) return 'expired'
  return 'active'
}

export default function SignupLinksPage() {
  const t = useTranslations('signupLinks')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const router = useRouter()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [links, setLinks] = React.useState<SignupLink[]>([])
  const [pendingCount, setPendingCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [showShareDialog, setShowShareDialog] = React.useState<SignupLink | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<SignupLink | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [linksRes, countRes] = await Promise.all([
        getSignupLinks(campusId),
        getPendingCount(),
      ])
      if (linksRes.success) setLinks(linksRes.data ?? [])
      if (countRes.success) setPendingCount(countRes.data?.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [campusId])

  React.useEffect(() => { fetchData() }, [fetchData])

  const execCommandCopy = (url: string) => {
    // Append inside the currently-open Radix dialog (if any) so the textarea
    // sits within its focus trap — appending to document.body while a Dialog
    // is open can prevent .focus()/.select() from actually moving focus,
    // causing execCommand('copy') to silently return false.
    const container = document.querySelector('[role="dialog"]') ?? document.body
    const ta = document.createElement('textarea')
    ta.value = url
    // Position off-screen but still reachable (opacity:0 can break focus in some browsers)
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;'
    container.appendChild(ta)
    ta.focus()
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    container.removeChild(ta)
    return ok
  }

  const handleCopy = (link: SignupLink) => {
    const url = buildSignupUrl(link.token)

    const onSuccess = () => {
      setCopiedId(link.id)
      toast.success(t('copied'))
      setTimeout(() => setCopiedId(null), 2000)
    }

    const onFailure = () => {
      toast.error(isAr ? 'تعذر نسخ الرابط' : 'Could not copy link')
    }

    // On HTTPS / localhost the Clipboard API is available; use it.
    // On plain HTTP we must copy synchronously inside the user-gesture callback
    // because execCommand('copy') loses the gesture context after an await/microtask.
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(onSuccess).catch(() => {
        if (execCommandCopy(url)) onSuccess()
        else onFailure()
      })
    } else {
      if (execCommandCopy(url)) onSuccess()
      else onFailure()
    }
  }

  const handleToggle = async (link: SignupLink) => {
    const status = getLinkStatus(link)
    if (status === 'expired') return
    if (link.is_active) {
      await deactivateSignupLink(link.id)
      toast.success(t('deactivate'))
    } else {
      await activateSignupLink(link.id)
      toast.success(t('activate'))
    }
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteSignupLink(deleteTarget.id)
    toast.success(t('delete'))
    setDeleteTarget(null)
    fetchData()
  }

  const activeCount = links.filter(l => getLinkStatus(l) === 'active').length
  const totalUses = links.reduce((sum, l) => sum + l.use_count, 0)

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            {t('pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? 'أنشئ روابط دعوة للمستخدمين للانضمام إلى مدرستك' : 'Create invite links for users to join your school'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button
            className="gradient-blue text-white border-0 gap-2"
            onClick={() => router.push('/admin/signup-links/new')}
          >
            <Plus className="h-4 w-4" />
            {t('generateBtn')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isAr ? 'إجمالي الروابط' : 'Total Links', value: links.length, color: 'from-[#57A3CC] to-[#022172]' },
          { label: isAr ? 'روابط نشطة' : 'Active Links', value: activeCount, color: 'from-green-500 to-green-700' },
          { label: isAr ? 'مجموع الاستخدامات' : 'Total Signups', value: totalUses, color: 'from-orange-400 to-orange-600' },
          { label: isAr ? 'طلبات معلقة' : 'Pending Approvals', value: pendingCount, color: 'from-purple-500 to-purple-700' },
        ].map((s) => (
          <Card key={s.label} className={`bg-gradient-to-br ${s.color} text-white`}>
            <CardContent className="p-4">
              <div className="text-3xl font-bold">{s.value}</div>
              <p className="text-white/80 text-xs mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Links List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : links.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">{t('emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('emptyDesc')}</p>
            <Button className="gradient-blue text-white border-0" onClick={() => router.push('/admin/signup-links/new')}>
              <Plus className="h-4 w-4 me-2" />
              {t('generateBtn')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const status = getLinkStatus(link)
            const url = buildSignupUrl(link.token)
            return (
              <Card key={link.id} className={cn(
                'border transition-all',
                status === 'active' ? 'border-gray-200' : 'border-gray-100 opacity-70'
              )}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {link.label || `${link.role} link`}
                        </span>
                        <Badge className={cn('text-xs', ROLE_COLORS[link.role] ?? 'bg-gray-100 text-gray-800')}>
                          {link.role}
                        </Badge>
                        <Badge
                          variant={status === 'active' ? 'default' : 'secondary'}
                          className={cn(
                            'text-xs',
                            status === 'active' ? 'bg-green-500 text-white' :
                            status === 'expired' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          )}
                        >
                          {t(`status${status.charAt(0).toUpperCase() + status.slice(1)}` as any)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>
                          {t('tableUses')}: {link.use_count}{link.max_uses ? ` / ${link.max_uses}` : ` / ${t('unlimited')}`}
                        </span>
                        <span>
                          {t('tableExpires')}: {link.expires_at ? new Date(link.expires_at).toLocaleDateString() : t('never')}
                        </span>
                        <span className="font-mono text-[10px] truncate max-w-[200px]">{url}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Copy */}
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => handleCopy(link)}>
                        {copiedId === link.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline text-xs">{copiedId === link.id ? t('copied') : t('copyLink')}</span>
                      </Button>
                      {/* Share */}
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setShowShareDialog(link)}>
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                      {/* Toggle active */}
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn('h-8', link.is_active ? 'text-orange-600 border-orange-300' : 'text-green-600 border-green-300')}
                        onClick={() => handleToggle(link)}
                        disabled={status === 'expired'}
                        title={link.is_active ? t('deactivate') : t('activate')}
                      >
                        {link.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      </Button>
                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => setDeleteTarget(link)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Share Dialog */}
      <Dialog open={!!showShareDialog} onOpenChange={(o) => { if (!o) setShowShareDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('share')}</DialogTitle>
          </DialogHeader>
          {showShareDialog && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {isAr ? 'شارك هذا الرابط مع المستخدمين للتسجيل:' : 'Share this link with users to sign up:'}
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 text-sm font-mono break-all text-gray-900 dark:text-gray-100">
                {buildSignupUrl(showShareDialog.token)}
              </div>
              <Button
                className="w-full gradient-blue text-white border-0 gap-2"
                onClick={() => handleCopy(showShareDialog)}
              >
                {copiedId === showShareDialog.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedId === showShareDialog.id ? t('copied') : t('copyLink')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
