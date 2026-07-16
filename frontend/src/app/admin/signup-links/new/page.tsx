'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Check, Copy, ArrowLeft, Plus, Trash2 } from 'lucide-react'
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

import { useCampus } from '@/context/CampusContext'
import {
  generateSignupLink,
  buildSignupUrl,
  getProfileFields,
  type SignupLink,
  type SignupCustomField,
  type ProfileFieldDef,
} from '@/lib/api/signup-links'
import { getGradeLevels, type GradeLevel } from '@/lib/api/academics'
import { useRouter } from 'next/navigation'

const ROLES = ['teacher', 'student', 'parent', 'staff', 'librarian'] as const

export default function NewSignupLinkPage() {
  const t = useTranslations('signupLinks')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const router = useRouter()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [gradeLevels, setGradeLevels] = React.useState<GradeLevel[]>([])
  // per-profile-field toggles: keyed by `${table}.${column}`
  const [profileFieldConfig, setProfileFieldConfig] = React.useState<
    Record<string, { shown: boolean; required: boolean }>
  >({})
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
      first_name_required: true,
      last_name_required: true,
      phone_enabled: true,
      phone_required: false,
    },
  })
  const [generating, setGenerating] = React.useState(false)
  const [generatedLink, setGeneratedLink] = React.useState<SignupLink | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [profileFields, setProfileFields] = React.useState<ProfileFieldDef[]>([])

  React.useEffect(() => {
    if (campusId) {
      getGradeLevels(campusId).then(res => {
        if (res.success && res.data) setGradeLevels(res.data)
      })
      setForm(f => ({ ...f, campus_id: campusId }))
    }
  }, [campusId])

  React.useEffect(() => {
    getProfileFields(form.role).then(res => {
      if (res.success && res.data) {
        setProfileFields(res.data)
        // Reset config for newly loaded fields (preserve any the user already toggled)
        setProfileFieldConfig(prev => {
          const next: Record<string, { shown: boolean; required: boolean }> = {}
          for (const f of res.data!) {
            const key = `${f.table}.${f.column}`
            next[key] = prev[key] ?? { shown: false, required: false }
          }
          return next
        })
      }
    })
  }, [form.role])

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
      setCopiedId(link.id)
      toast.success(t('copied'))
      setTimeout(() => setCopiedId(null), 2000)
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
      if ((form.role === 'student' || form.role === 'parent') && form.selected_grade_ids.length > 0) {
        const selectedGrades = gradeLevels.filter(g => form.selected_grade_ids.includes(g.id))
        custom_fields.push({
          id: 'grade_level',
          label: isAr ? 'الصف الدراسي' : 'Grade Level',
          type: 'select',
          required: true,
          options: selectedGrades.map(g => g.name),
        })
      }

      // Profile fields that the admin toggled ON
      for (const pf of profileFields) {
        const key = `${pf.table}.${pf.column}`
        const cfg = profileFieldConfig[key]
        if (!cfg?.shown) continue
        custom_fields.push({
          id: pf.column,
          label: isAr ? pf.label_ar : pf.label_en,
          type: pf.type,
          required: cfg.required,
          options: pf.options ? pf.options.map(o => o.id) : undefined,
          source: 'profile_field',
          mapping: { table: pf.table, column: pf.column },
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
          standard_fields: {
            first_name: { required: form.standard_fields.first_name_required },
            last_name: { required: form.standard_fields.last_name_required },
            phone: { enabled: form.standard_fields.phone_enabled, required: form.standard_fields.phone_required },
          },
        },
      })
      if (res.success && res.data) {
        setGeneratedLink(res.data)
      } else {
        toast.error(res.error ?? 'Failed to generate link')
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
                {copiedId === generatedLink.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedId === generatedLink.id ? t('copied') : t('copyLink')}
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
            {t('generateTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? 'أنشئ رابطاً دعوة مخصصاً للمستخدمين' : 'Create a custom invite link for users to sign up.'}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        role: r,
                        selected_grade_ids: (r === 'student' || r === 'parent') ? f.selected_grade_ids : [],
                      }))}
                      className={cn(
                        'py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all capitalize',
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
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
                      {gradeLevels.map((g) => {
                        const checked = form.selected_grade_ids.includes(g.id)
                        return (
                          <label
                            key={g.id}
                            className={cn(
                              'flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
                              checked
                                ? 'border-[#022172] bg-white shadow-sm dark:bg-slate-800'
                                : 'border-transparent bg-transparent hover:bg-white dark:hover:bg-slate-800'
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => setForm(f => ({
                                ...f,
                                selected_grade_ids: c
                                  ? [...f.selected_grade_ids, g.id]
                                  : f.selected_grade_ids.filter(id => id !== g.id),
                              }))}
                            />
                            <span className="truncate">{g.name}</span>
                          </label>
                        )
                      })}
                    </div>
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

                {/* Always-on read-only indicators */}
                {[{ label: isAr ? 'البريد الإلكتروني' : 'Email', note: isAr ? 'مطلوب دائماً' : 'Always required' },
                  { label: isAr ? 'كلمة المرور' : 'Password', note: isAr ? 'مطلوب دائماً' : 'Always required' }].map(f => (
                  <div key={f.label} className="flex items-center justify-between px-4 py-3 border dark:border-slate-800 rounded-xl bg-gray-50/30 dark:bg-slate-900/30 opacity-60">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground italic">{f.note}</span>
                  </div>
                ))}

                {/* First Name */}
                <div className="flex items-center justify-between px-4 py-3 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
                  <span className="text-sm font-medium">{isAr ? 'الاسم الأول' : 'First Name'}</span>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="fn-req" className="text-xs text-muted-foreground cursor-pointer">{isAr ? 'إلزامي' : 'Required'}</Label>
                    <Switch id="fn-req" checked={form.standard_fields.first_name_required}
                      onCheckedChange={(c) => setForm(f => ({ ...f, standard_fields: { ...f.standard_fields, first_name_required: c } }))} />
                  </div>
                </div>

                {/* Last Name */}
                <div className="flex items-center justify-between px-4 py-3 border dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
                  <span className="text-sm font-medium">{isAr ? 'اسم العائلة' : 'Last Name'}</span>
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
                      ? 'شغّل الحقول التي تريد ظهورها في النموذج. ستُكتب الإجابات مباشرة في ملف المستخدم عند الموافقة.'
                      : 'Toggle fields to include in the form. Answers will be written directly to the user profile on approval.'}
                  </p>
                  <div className="space-y-2">
                    {profileFields.map(pf => {
                      const key = `${pf.table}.${pf.column}`
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
                            {field.source === 'profile_field' ? (
                              <div className="h-9 flex items-center px-3 rounded-md border dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-xs text-muted-foreground">
                                {isAr ? 'يرتبط بـ: ' : 'Maps to: '}{field.mapping?.table}.{field.mapping?.column}
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

                        {field.type === 'select' && field.source !== 'profile_field' && (
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
                  {generating ? t('generating') : t('generateSubmit')}
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
