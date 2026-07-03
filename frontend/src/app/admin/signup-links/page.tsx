'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Plus, Link2, Copy, Check, Trash2, Power, PowerOff, Share2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FileUpload } from '@/components/ui/file-upload'
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
  generateSignupLink,
  deactivateSignupLink,
  activateSignupLink,
  deleteSignupLink,
  buildSignupUrl,
  type SignupLink,
} from '@/lib/api/signup-links'
import { getPendingCount } from '@/lib/api/pending-signups'
import { getGradeLevels, type GradeLevel } from '@/lib/api/academics'
import { formatDistanceToNow, parseISO } from 'date-fns'

const ROLES = ['teacher', 'student', 'parent', 'staff', 'librarian'] as const

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
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [links, setLinks] = React.useState<SignupLink[]>([])
  const [pendingCount, setPendingCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [showGenerateDialog, setShowGenerateDialog] = React.useState(false)
  const [showShareDialog, setShowShareDialog] = React.useState<SignupLink | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<SignupLink | null>(null)
  const [generatedLink, setGeneratedLink] = React.useState<SignupLink | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const [gradeLevels, setGradeLevels] = React.useState<GradeLevel[]>([])
  const [form, setForm] = React.useState({
    role: 'teacher' as string,
    label: '',
    unlimited: true,
    max_uses: '',
    neverExpires: true,
    expires_at: '',
    campus_id: campusId ?? '',
    poster_url: '',
    description: '',
    require_grade_level: false,
    custom_fields: [] as Array<{ id: string; label: string; type: 'text' | 'select'; required: boolean; options: string }>,
  })
  const [generating, setGenerating] = React.useState(false)

  React.useEffect(() => {
    if (campusId) {
      getGradeLevels(campusId).then(res => {
        if (res.success && res.data) setGradeLevels(res.data)
      })
    }
  }, [campusId])

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
    const ta = document.createElement('textarea')
    ta.value = url
    // Position off-screen but still reachable (opacity:0 can break focus in some browsers)
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }

  const handleCopy = (link: SignupLink) => {
    const url = buildSignupUrl(link.token)

    const onSuccess = () => {
      setCopiedId(link.id)
      toast.success(t('copied'))
      setTimeout(() => setCopiedId(null), 2000)
    }

    // On HTTPS / localhost the Clipboard API is available; use it.
    // On plain HTTP we must copy synchronously inside the user-gesture callback
    // because execCommand('copy') loses the gesture context after an await/microtask.
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(onSuccess).catch(() => {
        execCommandCopy(url)
        onSuccess()
      })
    } else {
      execCommandCopy(url)
      onSuccess()
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

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const custom_fields = []
      if (form.require_grade_level && gradeLevels.length > 0) {
        custom_fields.push({
          id: 'grade_level',
          label: isAr ? 'الصف الدراسي' : 'Grade Level',
          type: 'select',
          required: true,
          options: gradeLevels.map(g => g.name),
        })
      }

      form.custom_fields.forEach(cf => {
        if (cf.label.trim()) {
          custom_fields.push({
            id: cf.id,
            label: cf.label.trim(),
            type: cf.type,
            required: cf.required,
            options: cf.type === 'select' ? cf.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          })
        }
      })

      const res = await generateSignupLink({
        role: form.role,
        label: form.label || null,
        max_uses: form.unlimited ? null : parseInt(form.max_uses, 10) || null,
        expires_at: form.neverExpires ? null : (form.expires_at || null),
        campus_id: form.campus_id || null,
        meta: {
          poster_url: form.poster_url || null,
          description: form.description || null,
          custom_fields,
        },
      })
      if (res.success && res.data) {
        setGeneratedLink(res.data)
        fetchData()
      } else {
        toast.error(res.error ?? 'Failed to generate link')
      }
    } finally {
      setGenerating(false)
    }
  }

  const resetGenerateForm = () => {
    setForm({ 
      role: 'teacher', label: '', unlimited: true, max_uses: '', neverExpires: true, 
      expires_at: '', campus_id: campusId ?? '', poster_url: '', description: '', require_grade_level: false, custom_fields: [] 
    })
    setGeneratedLink(null)
    setShowGenerateDialog(false)
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
            onClick={() => setShowGenerateDialog(true)}
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
            <Button className="gradient-blue text-white border-0" onClick={() => setShowGenerateDialog(true)}>
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

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={(o) => { if (!o) resetGenerateForm(); setShowGenerateDialog(o) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('generateTitle')}</DialogTitle>
            <DialogDescription>
              {isAr ? 'أنشئ رابطاً دعوة مخصصاً للمستخدمين' : 'Create a custom invite link for users to sign up.'}
            </DialogDescription>
          </DialogHeader>

          {!generatedLink ? (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="basic">{isAr ? 'أساسي' : 'Basic'}</TabsTrigger>
                <TabsTrigger value="advanced">{isAr ? 'متقدم وتصميم' : 'Advanced & Design'}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 py-2">
                {/* Role */}
                <div className="space-y-1.5">
                  <Label>{t('fieldRole')}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, role: r }))}
                        className={cn(
                          'py-2 px-3 rounded-lg text-sm font-medium border transition-all capitalize',
                          form.role === r
                            ? 'border-[#022172] bg-[#022172] text-white'
                            : 'border-gray-200 hover:border-[#57A3CC] hover:text-[#022172]'
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Label */}
                <div className="space-y-1.5">
                  <Label>{t('fieldLabel')}</Label>
                  <Input
                    placeholder={t('fieldLabelPlaceholder')}
                    value={form.label}
                    onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">{t('fieldLabelHint')}</p>
                </div>

                {/* Max Uses */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{t('fieldMaxUses')}</Label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, unlimited: !f.unlimited }))}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border transition-colors',
                        form.unlimited ? 'bg-[#022172] text-white border-[#022172]' : 'border-gray-300'
                      )}
                    >
                      {t('fieldMaxUsesUnlimited')}
                    </button>
                  </div>
                  {!form.unlimited && (
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 50"
                      value={form.max_uses}
                      onChange={(e) => setForm(f => ({ ...f, max_uses: e.target.value }))}
                    />
                  )}
                </div>

                {/* Expiry */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{t('fieldExpiry')}</Label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, neverExpires: !f.neverExpires }))}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border transition-colors',
                        form.neverExpires ? 'bg-[#022172] text-white border-[#022172]' : 'border-gray-300'
                      )}
                    >
                      {t('fieldExpiryNever')}
                    </button>
                  </div>
                  {!form.neverExpires && (
                    <Input
                      type="date"
                      value={form.expires_at}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 py-2">
                {/* Poster */}
                <div className="space-y-1.5">
                  <Label>{isAr ? 'صورة الغلاف / الملصق' : 'Cover Image / Poster'}</Label>
                  <FileUpload
                    value={form.poster_url}
                    onChange={(url) => setForm(f => ({ ...f, poster_url: url }))}
                    accept="image/*"
                    label={isAr ? 'رفع ملصق' : 'Upload Poster'}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? 'سيظهر هذا الملصق في صفحة التسجيل.' : 'This image will be displayed on the public signup page.'}
                  </p>
                </div>

                {/* Require Grade Level */}
                {(form.role === 'student' || form.role === 'parent') && (
                  <div className="flex items-center justify-between p-3 border dark:border-slate-800 rounded-lg bg-gray-50/50 dark:bg-slate-800/50">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">{isAr ? 'طلب تحديد الصف الدراسي' : 'Require Grade Level'}</Label>
                      <p className="text-xs text-muted-foreground">
                        {isAr ? 'إضافة حقل الصف الدراسي لنموذج التسجيل' : 'Add a required Grade Level dropdown to the signup form'}
                      </p>
                    </div>
                    <Switch
                      checked={form.require_grade_level}
                      onCheckedChange={(c) => setForm(f => ({ ...f, require_grade_level: c }))}
                    />
                  </div>
                )}

                {/* Additional Custom Fields */}
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <Label>{isAr ? 'حقول مخصصة إضافية' : 'Additional Custom Fields'}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setForm(f => ({
                        ...f,
                        custom_fields: [...f.custom_fields, { id: `field_${Date.now()}`, label: '', type: 'text', required: false, options: '' }]
                      }))}
                    >
                      <Plus className="h-3 w-3 me-1" />
                      {isAr ? 'إضافة حقل' : 'Add Field'}
                    </Button>
                  </div>
                  
                  {form.custom_fields.length > 0 && (
                    <div className="space-y-3">
                      {form.custom_fields.map((field, idx) => (
                        <div key={field.id} className="p-3 border dark:border-slate-800 rounded-lg bg-gray-50/50 dark:bg-slate-800/50 space-y-3 relative group">
                          <button
                            type="button"
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setForm(f => ({ ...f, custom_fields: f.custom_fields.filter((_, i) => i !== idx) }))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          
                          <div className="grid grid-cols-2 gap-3 pr-6">
                            <div className="space-y-1.5">
                              <Label className="text-xs">{isAr ? 'اسم الحقل' : 'Field Label'}</Label>
                              <Input
                                className="h-8 text-sm"
                                placeholder={isAr ? 'مثال: رقم الهوية' : 'e.g. National ID'}
                                value={field.label}
                                onChange={(e) => {
                                  const newFields = [...form.custom_fields]
                                  newFields[idx].label = e.target.value
                                  setForm(f => ({ ...f, custom_fields: newFields }))
                                }}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">{isAr ? 'نوع الحقل' : 'Field Type'}</Label>
                              <Select
                                value={field.type}
                                onValueChange={(v: 'text' | 'select') => {
                                  const newFields = [...form.custom_fields]
                                  newFields[idx].type = v
                                  setForm(f => ({ ...f, custom_fields: newFields }))
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">{isAr ? 'نص' : 'Text Input'}</SelectItem>
                                  <SelectItem value="select">{isAr ? 'قائمة منسدلة' : 'Dropdown (Select)'}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {field.type === 'select' && (
                            <div className="space-y-1.5 pr-6">
                              <Label className="text-xs">{isAr ? 'الخيارات (مفصولة بفاصلة)' : 'Options (comma separated)'}</Label>
                              <Input
                                className="h-8 text-sm"
                                placeholder="Option 1, Option 2, Option 3"
                                value={field.options}
                                onChange={(e) => {
                                  const newFields = [...form.custom_fields]
                                  newFields[idx].options = e.target.value
                                  setForm(f => ({ ...f, custom_fields: newFields }))
                                }}
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <Switch
                              id={`req-${field.id}`}
                              checked={field.required}
                              onCheckedChange={(c) => {
                                const newFields = [...form.custom_fields]
                                newFields[idx].required = c
                                setForm(f => ({ ...f, custom_fields: newFields }))
                              }}
                            />
                            <Label htmlFor={`req-${field.id}`} className="text-xs cursor-pointer">
                              {isAr ? 'حقل إلزامي' : 'Required Field'}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            /* Success state */
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">{t('generateSuccessTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('generateSuccessDesc')}</p>
              <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 text-sm font-mono break-all text-start text-gray-900 dark:text-gray-100">
                {buildSignupUrl(generatedLink.token)}
              </div>
              <Button
                className="w-full gradient-blue text-white border-0 gap-2"
                onClick={() => handleCopy(generatedLink)}
              >
                {copiedId === generatedLink.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedId === generatedLink.id ? t('copied') : t('copyLink')}
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!generatedLink ? (
              <>
                <Button variant="outline" onClick={resetGenerateForm}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
                <Button
                  className="gradient-blue text-white border-0"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? t('generating') : t('generateSubmit')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setGeneratedLink(null)}>
                  {t('generateAnother')}
                </Button>
                <Button onClick={resetGenerateForm}>{t('done')}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
