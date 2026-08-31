'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Check, Copy, ArrowLeft, Plus, Trash2, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { FileUpload } from '@/components/ui/file-upload'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

import { useCampus } from '@/context/CampusContext'
import {
  generateSignupLink,
  updateSignupLink,
  buildSignupUrl,
  getProfileFields,
  type SignupLink,
  type SignupCustomField,
  type ProfileFieldDef,
} from '@/lib/api/signup-links'
import { getGradeLevels, type GradeLevel } from '@/lib/api/academics'
import { useRouter } from 'next/navigation'

const ROLES = ['teacher', 'student', 'parent', 'staff', 'librarian'] as const

// Custom-field-sourced defs have no fixed table/column — key them by field_key instead.
const profileFieldKey = (f: ProfileFieldDef) =>
  f.source === 'custom_field' ? `custom_field.${f.field_key}` : `${f.table}.${f.column}`

interface SignupLinkFormProps {
  mode: 'create' | 'edit'
  /** Required for edit mode — the link being edited, fetched by the page before mounting this. */
  initial?: SignupLink
}

export function SignupLinkForm({ mode, initial }: SignupLinkFormProps) {
  const t = useTranslations('signupLinks')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const router = useRouter()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [gradeLevels, setGradeLevels] = React.useState<GradeLevel[]>([])
  const [gradeDropdownOpen, setGradeDropdownOpen] = React.useState(false)
  // per-profile-field toggles: keyed by `${table}.${column}`
  const [profileFieldConfig, setProfileFieldConfig] = React.useState<
    Record<string, { shown: boolean; required: boolean }>
  >({})
  const initialStandard = initial?.meta?.standard_fields
  const [form, setForm] = React.useState({
    role: initial?.role ?? ('teacher' as string),
    label: initial?.label ?? '',
    unlimited: initial ? initial.max_uses == null : true,
    max_uses: initial?.max_uses != null ? String(initial.max_uses) : '',
    neverExpires: initial ? !initial.expires_at : true,
    expires_at: initial?.expires_at ? initial.expires_at.split('T')[0] : '',
    campus_id: initial?.campus_id ?? campusId ?? '',
    poster_url: initial?.meta?.poster_url ?? '',
    description: initial?.meta?.description ?? '',
    selected_grade_ids: [] as string[],
    custom_fields: [] as Array<{
      id: string
      label: string
      type: 'text' | 'select' | 'textarea' | 'date'
      required: boolean
      options: string
      source?: 'custom'
    }>,
    standard_fields: {
      first_name_required: initialStandard?.first_name?.required ?? true,
      last_name_required: initialStandard?.last_name?.required ?? true,
      phone_enabled: initialStandard?.phone?.enabled ?? true,
      phone_required: initialStandard?.phone?.required ?? false,
      email_enabled: initialStandard?.email?.enabled ?? true,
      email_required: initialStandard?.email?.required ?? false,
      username_enabled: initialStandard?.username?.enabled ?? false,
      username_required: initialStandard?.username?.required ?? false,
    },
  })
  const [generating, setGenerating] = React.useState(false)
  const [generatedLink, setGeneratedLink] = React.useState<SignupLink | null>(null)
  const [profileFields, setProfileFields] = React.useState<ProfileFieldDef[]>([])
  const reconciledEdit = React.useRef(false)

  React.useEffect(() => {
    const cid = mode === 'edit' ? form.campus_id : campusId
    if (cid) {
      getGradeLevels(cid).then(res => {
        if (res.success && res.data) setGradeLevels(res.data)
      })
    }
    if (mode === 'create' && campusId) {
      setForm(f => ({ ...f, campus_id: campusId }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId])

  React.useEffect(() => {
    getProfileFields(form.role).then(res => {
      if (res.success && res.data) {
        setProfileFields(res.data)
        // Reset config for newly loaded fields (preserve any the user already toggled)
        setProfileFieldConfig(prev => {
          const next: Record<string, { shown: boolean; required: boolean }> = {}
          for (const f of res.data!) {
            const key = profileFieldKey(f)
            next[key] = prev[key] ?? { shown: false, required: false }
          }
          return next
        })
      }
    })
  }, [form.role])

  // Edit mode: once the role's profile fields and this campus's grade levels
  // have both loaded, reconstruct which toggles were on from the link's
  // already-saved meta.custom_fields[]. Runs once (ref-guarded) — re-running
  // on every profileFields/gradeLevels refresh would stomp on the admin's
  // own in-progress edits.
  React.useEffect(() => {
    if (mode !== 'edit' || !initial || reconciledEdit.current) return
    if (profileFields.length === 0 && (initial.meta?.custom_fields?.length ?? 0) > 0) return // wait for profileFields to load
    reconciledEdit.current = true

    const metaCustomFields = initial.meta?.custom_fields ?? []

    const gradeField = metaCustomFields.find(f => f.id === 'grade_level')
    if (gradeField && gradeLevels.length > 0) {
      const ids = gradeLevels.filter(g => gradeField.options?.includes(g.name)).map(g => g.id)
      setForm(f => ({ ...f, selected_grade_ids: ids }))
    }

    // Match each stored field against the *current* profile-fields list (by
    // the same table/column or field_key identity used when the field was
    // originally saved) — deliberately re-matched against what's available
    // now rather than trusting the stored `source`/`mapping` alone, so a
    // custom field renamed/removed since this link was created is handled
    // sanely (falls through to "freeform" below instead of vanishing).
    const nextPFC: Record<string, { shown: boolean; required: boolean }> = {}
    const matchedIds = new Set<string>()
    for (const pf of profileFields) {
      const matchId = pf.source === 'custom_field' ? pf.field_key : pf.column
      const stored = metaCustomFields.find(f => f.id === matchId)
      if (stored) {
        nextPFC[profileFieldKey(pf)] = { shown: true, required: stored.required }
        matchedIds.add(stored.id)
      }
    }
    if (Object.keys(nextPFC).length > 0) {
      setProfileFieldConfig(prev => ({ ...prev, ...nextPFC }))
    }

    const leftoverFreeform = metaCustomFields
      .filter(f => f.id !== 'grade_level' && !matchedIds.has(f.id))
      .map(f => ({
        id: f.id,
        label: f.label,
        type: (f.type === 'checkbox' || f.type === 'multi-select' ? 'text' : f.type) as 'text' | 'select' | 'textarea' | 'date',
        required: f.required,
        options: (f.options ?? []).join(', '),
        source: 'custom' as const,
      }))
    if (leftoverFreeform.length > 0) {
      setForm(f => ({ ...f, custom_fields: leftoverFreeform }))
    }
  }, [mode, initial, profileFields, gradeLevels])

  const setPFC = (key: string, patch: Partial<{ shown: boolean; required: boolean }>) =>
    setProfileFieldConfig(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))


  const execCommandCopy = (url: string) => {
    const container = document.body
    const ta = document.createElement('textarea')
    ta.value = url
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;'
    container.appendChild(ta)
    ta.focus()
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    container.removeChild(ta)
    return ok
  }

  const handleCopy = (link: SignupLink) => {
    const url = buildSignupUrl(link.token)
    const onSuccess = () => {
      toast.success(t('copied'))
    }
    const onFailure = () => toast.error(isAr ? 'تعذر نسخ الرابط' : 'Could not copy link')

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

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const custom_fields: SignupCustomField[] = []
      if ((form.role === 'student' || form.role === 'parent') && gradeLevels.length > 0) {
        // If the admin restricted the link to specific grades, only offer those.
        // Otherwise fall back to every grade at this campus so the applicant can
        // still pick one instead of the form having no grade field at all.
        const offeredGrades = form.selected_grade_ids.length > 0
          ? gradeLevels.filter(g => form.selected_grade_ids.includes(g.id))
          : gradeLevels
        custom_fields.push({
          id: 'grade_level',
          label: isAr ? 'الصف الدراسي' : 'Grade Level',
          type: 'select',
          required: true,
          options: offeredGrades.map(g => g.name),
        })
      }

      // Profile fields that the admin toggled ON — already returned in the
      // order configured on the Custom Fields admin page (see
      // backend/src/services/signup-link-field-order.ts), so pushing them
      // in this iteration order is enough to keep that ordering.
      for (const pf of profileFields) {
        const key = profileFieldKey(pf)
        const cfg = profileFieldConfig[key]
        if (!cfg?.shown) continue
        if (pf.source === 'custom_field') {
          // School-defined custom field — no fixed column, so no mapping.
          // On approval this falls through into the entity's custom_fields JSONB,
          // keyed by field_key, same storage the Custom Fields feature reads from.
          custom_fields.push({
            id: pf.field_key!,
            label: isAr ? pf.label_ar : pf.label_en,
            type: pf.type,
            required: cfg.required,
            options: pf.options ? pf.options.map(o => o.id) : undefined,
          })
          continue
        }
        custom_fields.push({
          id: pf.column!,
          label: isAr ? pf.label_ar : pf.label_en,
          type: pf.type,
          required: cfg.required,
          options: pf.options ? pf.options.map(o => o.id) : undefined,
          source: 'profile_field',
          mapping: { table: pf.table!, column: pf.column! },
        })
      }

      // Freeform custom fields
      form.custom_fields.forEach(cf => {
        if (cf.label.trim()) {
          custom_fields.push({
            id: cf.id,
            label: cf.label.trim(),
            type: cf.type,
            required: cf.required,
            options: cf.type === 'select' ? cf.options.split(',').map(s => s.trim()).filter(Boolean) : undefined,
            source: 'custom',
          })
        }
      })

      const payload = {
        label: form.label || null,
        max_uses: form.unlimited ? null : parseInt(form.max_uses, 10) || null,
        expires_at: form.neverExpires ? null : (form.expires_at || null),
        campus_id: form.campus_id || null,
        meta: {
          poster_url: form.poster_url || null,
          description: form.description || null,
          custom_fields,
          standard_fields: {
            first_name: { required: form.standard_fields.first_name_required },
            last_name: { required: form.standard_fields.last_name_required },
            phone: { enabled: form.standard_fields.phone_enabled, required: form.standard_fields.phone_required },
            email: { enabled: form.standard_fields.email_enabled, required: form.standard_fields.email_required },
            username: { enabled: form.standard_fields.username_enabled, required: form.standard_fields.username_required },
          },
        },
      }

      const res = mode === 'edit' && initial
        ? await updateSignupLink(initial.id, payload)
        : await generateSignupLink({ ...payload, role: form.role })

      if (res.success && res.data) {
        if (mode === 'edit') {
          toast.success(isAr ? 'تم حفظ التغييرات' : 'Changes saved')
          router.push('/admin/signup-links')
        } else {
          setGeneratedLink(res.data)
        }
      } else {
        toast.error(res.error ?? 'Failed to save link')
      }
    } finally {
      setGenerating(false)
    }
  }

  if (generatedLink) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-10" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/signup-links')}>
            <ArrowLeft className={cn("h-5 w-5", isAr && "rotate-180")} />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            {t('generateSuccessTitle')}
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6 pb-8 px-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">{t('generateSuccessTitle')}</h3>
              <p className="text-muted-foreground">{t('generateSuccessDesc')}</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4 text-sm font-mono break-all text-center text-gray-900 dark:text-gray-100 max-w-xl mx-auto">
              {buildSignupUrl(generatedLink.token)}
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => router.push('/admin/signup-links')}
              >
                {t('done')}
              </Button>
              <Button
                className="gradient-blue text-white border-0 gap-2 px-8"
                onClick={() => handleCopy(generatedLink)}
              >
                <Copy className="h-4 w-4" />
                {t('copyLink')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/signup-links')}>
          <ArrowLeft className={cn("h-5 w-5", isAr && "rotate-180")} />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            {mode === 'edit' ? (isAr ? 'تعديل رابط التسجيل' : 'Edit Signup Link') : t('generateTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'edit'
              ? (isAr ? 'الرابط والدور ثابتان — يمكنك تعديل باقي الإعدادات' : "The link's URL and role stay fixed — everything else here is editable.")
              : (isAr ? 'أنشئ رابطاً دعوة مخصصاً للمستخدمين' : 'Create a custom invite link for users to sign up.')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? 'معلومات أساسية' : 'Basic Information'}</CardTitle>
              <CardDescription>{isAr ? 'حدد الدور والخصائص الأساسية للرابط' : 'Select the role and basic properties for the link'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Role */}
              <div className="space-y-2">
                <Label>{t('fieldRole')}</Label>
                {mode === 'edit' && (
                  <p className="text-xs text-muted-foreground">
                    {isAr ? 'لا يمكن تغيير الدور بعد الإنشاء.' : "Role can't be changed after a link is created."}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={mode === 'edit'}
                      onClick={() => setForm(f => ({
                        ...f,
                        role: r,
                        selected_grade_ids: (r === 'student' || r === 'parent') ? f.selected_grade_ids : [],
                      }))}
                      className={cn(
                        'py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all capitalize',
                        mode === 'edit' && 'opacity-60 cursor-not-allowed',
                        form.role === r
                          ? 'border-[#022172] bg-[#022172]/5 text-[#022172]'
                          : 'border-transparent bg-gray-50 hover:bg-gray-100 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-gray-300'
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade Levels */}
              {(form.role === 'student' || form.role === 'parent') && (
                <div className="space-y-2">
                  <Label>{isAr ? 'الصفوف الدراسية المتاحة' : 'Grade Levels Offered'}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? 'اختر الصفوف الدراسية التي يقدمها هذا الفرع ليختار منها المتقدم'
                      : "Select which of this campus's grade levels the applicant can choose from"}
                  </p>
                  {gradeLevels.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      {isAr ? 'لا توجد صفوف دراسية لهذا الفرع' : 'No grade levels found for this campus'}
                    </p>
                  ) : (
                    <Popover open={gradeDropdownOpen} onOpenChange={setGradeDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={gradeDropdownOpen}
                          className="w-full justify-between h-auto min-h-10 bg-gray-50/50 dark:bg-slate-900/50"
                        >
                          <div className="flex flex-wrap gap-1 flex-1 items-center">
                            {form.selected_grade_ids.length > 0 ? (
                              gradeLevels
                                .filter((g) => form.selected_grade_ids.includes(g.id))
                                .map((g) => (
                                  <Badge
                                    key={g.id}
                                    variant="secondary"
                                    className="bg-[#022172]/10 text-[#022172] border border-[#022172]/20 whitespace-nowrap"
                                  >
                                    {g.name}
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setForm(f => ({ ...f, selected_grade_ids: f.selected_grade_ids.filter(id => id !== g.id) }))
                                      }}
                                      className="ml-1 rounded-full hover:bg-[#022172]/20 cursor-pointer inline-flex shrink-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </span>
                                  </Badge>
                                ))
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                {isAr ? 'اختر الصفوف الدراسية...' : 'Select grade levels...'}
                              </span>
                            )}
                          </div>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="max-h-64 overflow-auto p-2">
                          {gradeLevels.map((g) => {
                            const checked = form.selected_grade_ids.includes(g.id)
                            return (
                              <div
                                key={g.id}
                                className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                                onClick={() => setForm(f => ({
                                  ...f,
                                  selected_grade_ids: checked
                                    ? f.selected_grade_ids.filter(id => id !== g.id)
                                    : [...f.selected_grade_ids, g.id],
                                }))}
                              >
                                <Checkbox checked={checked} onCheckedChange={() => {}} />
                                <label className="flex-1 cursor-pointer text-sm">{g.name}</label>
                              </div>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {/* Label */}
              <div className="space-y-2">
                <Label>{t('fieldLabel')}</Label>
                <Input
                  className="bg-gray-50/50 dark:bg-slate-900/50"
                  placeholder={t('fieldLabelPlaceholder')}
                  value={form.label}
                  onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">{t('fieldLabelHint')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-slate-800">
                {/* Max Uses */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('fieldMaxUses')}</Label>
                    <Switch
                      checked={form.unlimited}
                      onCheckedChange={(c) => setForm(f => ({ ...f, unlimited: c }))}
                    />
                  </div>
                  {!form.unlimited && (
                    <Input
                      className="bg-gray-50/50 dark:bg-slate-900/50"
                      type="number"
                      min={1}
                      placeholder="e.g. 50"
                      value={form.max_uses}
                      onChange={(e) => setForm(f => ({ ...f, max_uses: e.target.value }))}
                    />
                  )}
                  {form.unlimited && (
                    <div className="text-sm text-muted-foreground italic px-1 py-1.5">
                      {t('fieldMaxUsesUnlimited')}
                    </div>
                  )}
                </div>

                {/* Expiry */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t('fieldExpiry')}</Label>
                    <Switch
                      checked={form.neverExpires}
                      onCheckedChange={(c) => setForm(f => ({ ...f, neverExpires: c }))}
                    />
                  </div>
                  {!form.neverExpires && (
                    <Input
                      className="bg-gray-50/50 dark:bg-slate-900/50"
                      type="date"
                      value={form.expires_at}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    />
                  )}
                  {form.neverExpires && (
                    <div className="text-sm text-muted-foreground italic px-1 py-1.5">
                      {t('fieldExpiryNever')}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields Config */}
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? 'إعدادات النموذج' : 'Form Configuration'}</CardTitle>
              <CardDescription>{isAr ? 'اختر الحقول التي تظهر في صفحة التسجيل' : 'Choose which fields appear on the signup page'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* ── Fixed standard fields ── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  {isAr ? 'الحقول الأساسية' : 'Standard Fields'}
                </p>

                {/* Always-on read-only indicator — password is the one field that can never be optional */}
                <div className="flex items-center justify-between px-4 py-3 border dark:border-slate-800 rounded-xl bg-gray-50/30 dark:bg-slate-900/30 opacity-60">
                  <span className="text-sm font-medium">{isAr ? 'كلمة المرور' : 'Password'}</span>
                  <span className="text-xs text-muted-foreground italic">{isAr ? 'مطلوب دائماً' : 'Always required'}</span>
                </div>

                {/* Email — applicants who skip it are issued a username to log in with instead */}
                <div className="p-4 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="em-enabled" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إظهار' : 'Show'}</Label>
                      <Switch id="em-enabled" checked={form.standard_fields.email_enabled}
                        onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, email_enabled: c, email_required: c ? f.standard_fields.email_required : false } }))} />
                    </div>
                  </div>
                  {form.standard_fields.email_enabled && (
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                      <Label htmlFor="em-req" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إلزامي' : 'Required'}</Label>
                      <Switch id="em-req" checked={form.standard_fields.email_required}
                        onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, email_required: c } }))} />
                    </div>
                  )}
                  {form.standard_fields.email_enabled && !form.standard_fields.email_required && (
                    <p className="text-xs text-muted-foreground pt-1">
                      {isAr
                        ? 'المتقدمون الذين يتركون هذا الحقل فارغاً سيحصلون على اسم مستخدم لتسجيل الدخول بدلاً من ذلك.'
                        : 'Applicants who skip this are issued a username to log in with instead.'}
                    </p>
                  )}
                </div>

                {/* Username — lets applicants choose their own login username instead of
                    being issued a random one on approval */}
                <div className="p-4 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{isAr ? 'اسم المستخدم' : 'Username'}</span>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="un-enabled" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إظهار' : 'Show'}</Label>
                      <Switch id="un-enabled" checked={form.standard_fields.username_enabled}
                        onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, username_enabled: c, username_required: c ? f.standard_fields.username_required : false } }))} />
                    </div>
                  </div>
                  {form.standard_fields.username_enabled && (
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                      <Label htmlFor="un-req" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إلزامي' : 'Required'}</Label>
                      <Switch id="un-req" checked={form.standard_fields.username_required}
                        onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, username_required: c } }))} />
                    </div>
                  )}
                  {form.standard_fields.username_enabled && (
                    <p className="text-xs text-muted-foreground pt-1">
                      {isAr
                        ? 'إذا تم تفعيله، سيتم استخدام اسم المستخدم الذي يختاره المتقدم بدلاً من إنشاء اسم عشوائي عند الموافقة.'
                        : "If enabled, the applicant's chosen username is used instead of an auto-generated one on approval."}
                    </p>
                  )}
                </div>

                {/* First Name */}
                <div className="flex items-center justify-between px-4 py-3 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
                  <span className="text-sm font-medium">{isAr ? 'الاسم الأول' : 'First Name'}</span>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="fn-req" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إلزامي' : 'Required'}</Label>
                    <Switch id="fn-req" checked={form.standard_fields.first_name_required}
                      onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, first_name_required: c } }))} />
                  </div>
                </div>

                {/* Last Name — labeled "Surname" to match the same field's label on the
                    Custom Fields admin page (both are profiles.last_name); the Arabic
                    text was already identical between the two pages, only English differed. */}
                <div className="flex items-center justify-between px-4 py-3 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
                  <span className="text-sm font-medium">{isAr ? 'اسم العائلة' : 'Surname'}</span>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="ln-req" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إلزامي' : 'Required'}</Label>
                    <Switch id="ln-req" checked={form.standard_fields.last_name_required}
                      onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, last_name_required: c } }))} />
                  </div>
                </div>

                {/* Phone */}
                <div className="p-4 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{isAr ? 'رقم الهاتف' : 'Phone Number'}</span>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="ph-enabled" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إظهار' : 'Show'}</Label>
                      <Switch id="ph-enabled" checked={form.standard_fields.phone_enabled}
                        onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, phone_enabled: c, phone_required: c ? f.standard_fields.phone_required : false } }))} />
                    </div>
                  </div>
                  {form.standard_fields.phone_enabled && (
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                      <Label htmlFor="ph-req" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إلزامي' : 'Required'}</Label>
                      <Switch id="ph-req" checked={form.standard_fields.phone_required}
                        onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, phone_required: c } }))} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Profile fields for this role ── */}
              {profileFields.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    {isAr ? 'حقول الملف الشخصي' : 'Profile Fields'}
                  </p>
                  <p className="text-xs text-muted-foreground px-1 pb-1">
                    {isAr
                      ? 'شغّل الحقول التي تريد ظهورها في النموذج. مرتبة بنفس ترتيب صفحة الحقول المخصصة. ستُكتب الإجابات مباشرة في ملف المستخدم عند الموافقة.'
                      : 'Toggle fields to include in the form. Ordered to match the Custom Fields admin page. Answers will be written directly to the user profile on approval.'}
                  </p>
                  <div className="space-y-2">
                    {profileFields.map(pf => {
                      const key = profileFieldKey(pf)
                      const cfg = profileFieldConfig[key] ?? { shown: false, required: false }
                      return (
                        <div key={key} className={cn(
                          'border dark:border-slate-800 rounded-xl overflow-hidden transition-all',
                          cfg.shown ? 'bg-white dark:bg-slate-900 shadow-sm' : 'bg-gray-50/50 dark:bg-slate-900/30'
                        )}>
                          <div className="flex items-center justify-between px-4 py-3">
                            <div>
                              <span className="text-sm font-medium">{isAr ? pf.label_ar : pf.label_en}</span>
                              <span className="ms-2 text-[10px] text-muted-foreground bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                {pf.type}
                              </span>
                              {pf.source === 'custom_field' && (
                                <span className="ms-1 text-[10px] text-[#022172] bg-[#022172]/10 px-1.5 py-0.5 rounded-full">
                                  {isAr ? 'حقل مخصص' : 'Custom Field'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <Label htmlFor={`pf-show-${key}`} className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إظهار' : 'Show'}</Label>
                              <Switch
                                id={`pf-show-${key}`}
                                checked={cfg.shown}
                                onCheckedChange={(c) => setPFC(key, { shown: c, required: c ? cfg.required : false })}
                              />
                            </div>
                          </div>
                          {cfg.shown && (
                            <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                              <Label htmlFor={`pf-req-${key}`} className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إلزامي' : 'Required'}</Label>
                              <Switch
                                id={`pf-req-${key}`}
                                checked={cfg.required}
                                onCheckedChange={(c) => setPFC(key, { required: c })}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Additional freeform custom fields ── */}
              <div className="pt-4 space-y-4 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">{isAr ? 'حقول مخصصة إضافية' : 'Additional Custom Fields'}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'حقول لا تنتمي لملف المستخدم' : 'Fields not tied to the user profile'}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-white dark:bg-slate-900"
                    onClick={() => setForm(f => ({
                      ...f,
                      custom_fields: [...f.custom_fields, { id: `field_${Date.now()}`, label: '', type: 'text', required: false, options: '', source: 'custom' }]
                    }))}
                  >
                    <Plus className="h-3.5 w-3.5 me-1.5" />
                    {isAr ? 'إضافة حقل' : 'Add Field'}
                  </Button>
                </div>

                {form.custom_fields.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-muted-foreground text-sm">
                    {isAr ? 'لم يتم إضافة حقول مخصصة' : 'No custom fields added yet'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.custom_fields.map((field, idx) => (
                      <div key={field.id} className="p-4 border dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-4 relative group shadow-sm">
                        <button
                          type="button"
                          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors bg-white dark:bg-slate-900 rounded-full p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setForm(f => ({ ...f, custom_fields: f.custom_fields.filter((_, i) => i !== idx) }))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-10">
                          <div className="space-y-2">
                            <Label className="text-xs">{isAr ? 'اسم الحقل' : 'Field Label'}</Label>
                            <Input
                              className="h-9"
                              placeholder={isAr ? 'مثال: رقم الهوية' : 'e.g. National ID'}
                              value={field.label}
                              onChange={(e) => {
                                setForm(f => ({
                                  ...f,
                                  custom_fields: f.custom_fields.map((fld, i) =>
                                    i === idx ? { ...fld, label: e.target.value } : fld
                                  ),
                                }))
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{isAr ? 'نوع الحقل' : 'Field Type'}</Label>
                            {(field as any).source === 'profile_field' ? (
                              <div className="h-9 flex items-center px-3 rounded-md border dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-xs text-muted-foreground">
                                {isAr ? 'يرتبط بـ: ' : 'Maps to: '}{(field as any).mapping?.table}.{(field as any).mapping?.column}
                              </div>
                            ) : (
                              <Select
                                value={field.type}
                                onValueChange={(v: 'text' | 'select') => {
                                  setForm(f => ({
                                    ...f,
                                    custom_fields: f.custom_fields.map((fld, i) =>
                                      i === idx ? { ...fld, type: v } : fld
                                    ),
                                  }))
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">{isAr ? 'نص' : 'Text Input'}</SelectItem>
                                  <SelectItem value="select">{isAr ? 'قائمة منسدلة' : 'Dropdown (Select)'}</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>

                        {field.type === 'select' && (field as any).source !== 'profile_field' && (
                          <div className="space-y-2 pr-10">
                            <Label className="text-xs">{isAr ? 'الخيارات (مفصولة بفاصلة)' : 'Options (comma separated)'}</Label>
                            <Input
                              className="h-9"
                              placeholder="Option 1, Option 2, Option 3"
                              value={field.options}
                              onChange={(e) => {
                                setForm(f => ({
                                  ...f,
                                  custom_fields: f.custom_fields.map((fld, i) =>
                                    i === idx ? { ...fld, options: e.target.value } : fld
                                  ),
                                }))
                              }}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                          <Switch
                            id={`req-${field.id}`}
                            checked={field.required}
                            onCheckedChange={(c) => {
                              setForm(f => ({
                                ...f,
                                custom_fields: f.custom_fields.map((fld, i) =>
                                  i === idx ? { ...fld, required: c as boolean } : fld
                                ),
                              }))
                            }}
                          />
                          <Label htmlFor={`req-${field.id}`} className="text-sm cursor-pointer">
                            {isAr ? 'حقل إلزامي' : 'Required Field'}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Design Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? 'التصميم' : 'Design'}</CardTitle>
              <CardDescription>{isAr ? 'تخصيص مظهر صفحة التسجيل' : 'Customize the signup page appearance'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Poster */}
              <div className="space-y-3">
                <Label>{isAr ? 'صورة الغلاف / الملصق' : 'Cover Image / Poster'}</Label>
                <div className="bg-gray-50/50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-800 p-2">
                  <FileUpload
                    value={form.poster_url}
                    onChange={(url) => setForm(f => ({ ...f, poster_url: url }))}
                    accept="image/*"
                    label={isAr ? 'رفع ملصق' : 'Upload Poster'}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {isAr ? 'تظهر هذه الصورة في أعلى صفحة التسجيل.' : 'Displayed at the top of the signup page.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons pinned to side */}
          <div className="sticky top-6">
            <Card className="border-[#022172]/20 shadow-lg shadow-[#022172]/5">
              <CardContent className="p-6 space-y-4">
                <Button
                  className="w-full gradient-blue text-white border-0 h-12 text-base font-semibold"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating
                    ? (mode === 'edit' ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : t('generating'))
                    : (mode === 'edit' ? (isAr ? 'حفظ التغييرات' : 'Save Changes') : t('generateSubmit'))}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10"
                  onClick={() => router.push('/admin/signup-links')}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
