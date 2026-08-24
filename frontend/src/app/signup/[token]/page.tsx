'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { SchoolLogo } from '@/components/shared/SchoolLogo'
import {
  getSignupLinkInfo,
  submitSignup,
  type SignupLinkInfo,
} from '@/lib/api/public-signup'

const ROLE_COLORS: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-800',
  student: 'bg-green-100 text-green-800',
  parent: 'bg-purple-100 text-purple-800',
  staff: 'bg-orange-100 text-orange-800',
  librarian: 'bg-teal-100 text-teal-800',
  counselor: 'bg-pink-100 text-pink-800',
}

function passwordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  score = Math.min(4, score)

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
  return { score, label: labels[score] ?? '', color: colors[score] ?? '' }
}

type PageState = 'loading' | 'invalid' | 'form' | 'success'

// Language toggle — writes the locale cookie directly then hard-reloads.
// Signup links are shared via copy/paste and are commonly opened in fresh/incognito
// sessions with no `studently_language` cookie set yet, so the page always falls back
// to English regardless of what language the admin who generated the link was using.
// This lets the visitor switch without needing to log in first.
function LanguageToggle() {
  const locale = useLocale()
  const [switching, setSwitching] = React.useState(false)

  function toggle() {
    const next = locale === 'en' ? 'ar' : 'en'
    setSwitching(true)
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `studently_language=${next}; path=/; max-age=${maxAge}; samesite=lax`
    window.location.reload()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={switching}
      className="fixed top-4 end-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-all disabled:opacity-60 select-none"
      title={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
    >
      {switching ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span className="text-base leading-none">{locale === 'en' ? '🇸🇦' : '🇬🇧'}</span>
      )}
      <span>{locale === 'en' ? 'العربية' : 'English'}</span>
    </button>
  )
}

export default function SignupPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('publicSignup')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const token = typeof params.token === 'string' ? params.token : ''

  const [pageState, setPageState] = React.useState<PageState>('loading')
  const [invalidReason, setInvalidReason] = React.useState<string>('')
  const [linkInfo, setLinkInfo] = React.useState<SignupLinkInfo | null>(null)

  const [form, setForm] = React.useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    phone: '',
    password: '',
    confirm_password: '',
    extra_fields: {} as Record<string, any>,
  })
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<typeof form>>({})
  const [submitting, setSubmitting] = React.useState(false)

  const strength = passwordStrength(form.password)

  // Standard field config (first/last name, phone) — defaults reproduce the
  // pre-existing hardcoded behavior for links generated before this feature.
  const sf = linkInfo?.meta?.standard_fields ?? {}
  const firstNameRequired = sf.first_name?.required ?? true
  const lastNameRequired = sf.last_name?.required ?? true
  const phoneEnabled = sf.phone?.enabled ?? true
  const phoneRequired = phoneEnabled && (sf.phone?.required ?? false)
  const emailEnabled = sf.email?.enabled ?? true
  const usernameEnabled = sf.username?.enabled ?? true
  // Neither email nor username is individually required — the applicant just needs
  // to provide at least one of them (enforced in validate() below).

  // Load link info on mount
  React.useEffect(() => {
    if (!token) { setPageState('invalid'); setInvalidReason('link_not_found'); return }

    getSignupLinkInfo(token).then((res) => {
      if (res.success && res.data) {
        setLinkInfo(res.data)
        setPageState('form')
      } else {
        setInvalidReason(res.error ?? 'invalid_link')
        setPageState('invalid')
      }
    })
  }, [token])

  const validate = (): boolean => {
    const errs: Partial<typeof form> & { extra_fields?: Record<string, string> } = {}
    if (firstNameRequired && (!form.first_name.trim() || form.first_name.trim().length < 2)) errs.first_name = t('firstName') + ' is required'
    if (lastNameRequired && (!form.last_name.trim() || form.last_name.trim().length < 2)) errs.last_name = t('lastName') + ' is required'
    if (form.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('email') + ' is invalid'
    }
    if (form.username.trim()) {
      if (!/^[a-zA-Z0-9._-]{3,}$/.test(form.username.trim())) errs.username = t('usernameInvalid')
    }
    // At least one of email or username must be provided so the user has something to log in with.
    if ((emailEnabled || usernameEnabled) && !form.email.trim() && !form.username.trim()) {
      if (emailEnabled) errs.email = t('emailOrUsernameRequired')
      if (usernameEnabled) errs.username = t('emailOrUsernameRequired')
    }
    if (phoneRequired && !form.phone.trim()) errs.phone = t('phoneOptional') + ' is required'
    if (!form.password || form.password.length < 8) errs.password = t('passwordHint')
    if (form.password !== form.confirm_password) errs.confirm_password = t('passwordMismatch')

    // Validate custom fields
    if (linkInfo?.meta?.custom_fields) {
      const extraErrs: Record<string, string> = {}
      for (const field of linkInfo.meta.custom_fields) {
        const value = form.extra_fields[field.id]
        const isEmpty = field.type === 'multi-select' ? !Array.isArray(value) || value.length === 0 : !value
        if (field.required && isEmpty) {
          extraErrs[field.id] = `${field.label} is required`
        }
      }
      if (Object.keys(extraErrs).length > 0) errs.extra_fields = extraErrs
    }

    setErrors(errs as any)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const res = await submitSignup({
        token,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase() || undefined,
        username: form.username.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        confirm_password: form.confirm_password,
        extra_fields: form.extra_fields,
      })

      if (res.success) {
        setPageState('success')
      } else {
        const errKey = res.error ?? ''
        if (errKey === 'email_already_registered') {
          setErrors({ email: t('emailAlreadyRegistered') })
        } else if (errKey === 'username_already_taken') {
          setErrors({ username: t('usernameAlreadyTaken') })
        } else if (errKey === 'link_expired') {
          setInvalidReason('link_expired'); setPageState('invalid')
        } else if (errKey === 'link_maxed') {
          setInvalidReason('link_maxed'); setPageState('invalid')
        } else {
          toast.error(errKey || 'Submission failed')
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const invalidMessage: Record<string, string> = {
    link_not_found: t('invalidLinkMessage'),
    link_inactive: t('linkInactive'),
    link_expired: t('linkExpired'),
    link_maxed: t('linkMaxed'),
    invalid_link: t('invalidLinkMessage'),
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  // ── INVALID ──────────────────────────────────────────────────────────────────
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir={isAr ? 'rtl' : 'ltr'}>
        <LanguageToggle />
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t('invalidLinkTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {invalidMessage[invalidReason] ?? t('invalidLinkMessage')}
          </p>
          <p className="text-sm text-[#57A3CC] font-medium">{t('contactAdmin')}</p>
        </div>
      </div>
    )
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir={isAr ? 'rtl' : 'ltr'}>
        <LanguageToggle />
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('successTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('successMessage')}</p>
          <Button
            className="w-full bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white border-0"
            onClick={() => router.push('/auth/login')}
          >
            {t('goToLogin')}
          </Button>
        </div>
      </div>
    )
  }

  // ── FORM ─────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 sm:p-6 md:p-10 py-10"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <LanguageToggle />

      <div className="w-full max-w-4xl md:max-w-5xl bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all duration-300">
        {/* Header band */}
        <div className="bg-gradient-to-r from-[#57A3CC] to-[#022172] p-6 sm:p-8 md:p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-1">
            {linkInfo?.expires_at && (
              <div className="bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                {t('expires')}: {new Date(linkInfo.expires_at).toLocaleDateString()}
              </div>
            )}
            {linkInfo?.available_seats !== null && linkInfo?.available_seats !== undefined && (
              <div className="bg-orange-500 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                {linkInfo.available_seats} {t('seatsLeft', { fallback: 'seats left' })}
              </div>
            )}
          </div>

          <SchoolLogo
            logoUrl={linkInfo?.school_logo_url || linkInfo?.meta?.poster_url}
            alt={linkInfo?.school_name ?? 'School'}
            shape={linkInfo?.logo_shape}
            borderWidth={linkInfo?.logo_border_width}
            borderColor={linkInfo?.logo_border_color}
            size={84}
            className="mx-auto mb-3 shadow-lg border-2 border-white/20"
            fallback={
              <span className="text-3xl font-bold text-[#022172]">
                {(linkInfo?.school_name ?? 'S').charAt(0)}
              </span>
            }
          />

          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wide">{linkInfo?.school_name}</h1>
          {linkInfo?.label && (
            <p className="text-white/90 text-base mt-1 font-medium">{linkInfo.label}</p>
          )}

          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-white/80 text-sm font-medium">{t('invitedAs')}</span>
            {linkInfo?.role && (
              <span className={cn('px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm', ROLE_COLORS[linkInfo.role] ?? 'bg-white/20 text-white')}>
                {linkInfo.role}
              </span>
            )}
          </div>

          {linkInfo?.meta?.description && (
            <p className="text-white/80 text-sm max-w-2xl mx-auto mt-3 leading-relaxed">
              {linkInfo.meta.description}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 md:p-10 space-y-8">
          <div className="border-b border-gray-100 dark:border-slate-700 pb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('formTitle')}</h2>
          </div>

          {/* Responsive multi-column grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* First Name */}
              <div className="space-y-1.5 col-span-1">
                <label htmlFor="first_name" className="block text-sm font-semibold text-gray-800">
                  {t('firstName')} {firstNameRequired && <span className="text-red-500">*</span>}
                </label>
                <Input
                  id="first_name"
                  placeholder="Ahmad"
                  value={form.first_name}
                  onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                  className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900 placeholder:text-gray-400 h-10', errors.first_name ? 'border-red-400' : '')}
                  disabled={submitting}
                />
                {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
              </div>

              {/* Last Name */}
              <div className="space-y-1.5 col-span-1">
                <label htmlFor="last_name" className="block text-sm font-semibold text-gray-800">
                  {t('lastName')} {lastNameRequired && <span className="text-red-500">*</span>}
                </label>
                <Input
                  id="last_name"
                  placeholder="Ali"
                  value={form.last_name}
                  onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                  className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900 placeholder:text-gray-400 h-10', errors.last_name ? 'border-red-400' : '')}
                  disabled={submitting}
                />
                {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
              </div>

              {/* Custom Fields */}
              {linkInfo?.meta?.custom_fields?.map(field => {
                const isWideField = field.type === 'multi-select' || field.type === 'checkbox'
                return (
                  <div
                    key={field.id}
                    className={cn(
                      "space-y-1.5",
                      isWideField ? "col-span-1 md:col-span-2 lg:col-span-3" : "col-span-1"
                    )}
                  >
                    {field.type !== 'checkbox' && (
                      <label htmlFor={field.id} className="block text-sm font-semibold text-gray-800">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                    )}
                    {field.type === 'select' ? (
                      <Select
                        value={form.extra_fields[field.id] || ''}
                        onValueChange={(val) => setForm(f => ({ ...f, extra_fields: { ...f.extra_fields, [field.id]: val } }))}
                      >
                        <SelectTrigger className={cn('w-full border-gray-300 focus:ring-[#57A3CC] h-10', (errors as any).extra_fields?.[field.id] ? 'border-red-400' : '')}>
                          <SelectValue placeholder={field.placeholder || 'Select...'} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'multi-select' ? (
                      <div className={cn('space-y-1.5 rounded-md border p-2.5', (errors as any).extra_fields?.[field.id] ? 'border-red-400' : 'border-gray-300')}>
                        {field.options?.map(opt => {
                          const selected: string[] = Array.isArray(form.extra_fields[field.id]) ? form.extra_fields[field.id] : []
                          const checked = selected.includes(opt)
                          return (
                            <label key={opt} className="flex items-center gap-2 text-sm text-gray-800">
                              <Checkbox
                                checked={checked}
                                disabled={submitting}
                                onCheckedChange={(val) => setForm(f => {
                                  const current: string[] = Array.isArray(f.extra_fields[field.id]) ? f.extra_fields[field.id] : []
                                  const next = val ? [...current, opt] : current.filter(o => o !== opt)
                                  return { ...f, extra_fields: { ...f.extra_fields, [field.id]: next } }
                                })}
                              />
                              {opt}
                            </label>
                          )
                        })}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 pt-2">
                        <Checkbox
                          checked={!!form.extra_fields[field.id]}
                          disabled={submitting}
                          onCheckedChange={(val) => setForm(f => ({ ...f, extra_fields: { ...f.extra_fields, [field.id]: !!val } }))}
                        />
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                    ) : (
                      <Input
                        id={field.id}
                        type={field.type === 'date' ? 'date' : 'text'}
                        placeholder={field.placeholder}
                        value={form.extra_fields[field.id] || ''}
                        onChange={(e) => setForm(f => ({ ...f, extra_fields: { ...f.extra_fields, [field.id]: e.target.value } }))}
                        className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900 h-10', (errors as any).extra_fields?.[field.id] ? 'border-red-400' : '')}
                        disabled={submitting}
                      />
                    )}
                    {(errors as any).extra_fields?.[field.id] && <p className="text-xs text-red-500">{(errors as any).extra_fields[field.id]}</p>}
                  </div>
                )
              })}

              {/* Email */}
              {emailEnabled && (
                <div className="space-y-1.5 col-span-1">
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-800">
                    {t('email')} <span className="text-gray-400 font-normal">{isAr ? '(اختياري)' : '(optional)'}</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900 placeholder:text-gray-400 h-10', errors.email ? 'border-red-400' : '')}
                    disabled={submitting}
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                  {!errors.email && (
                    <p className="text-xs text-gray-400">{t('emailOrUsernameNote')}</p>
                  )}
                </div>
              )}

              {/* Username */}
              {usernameEnabled && (
                <div className="space-y-1.5 col-span-1">
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-800">
                    {t('username')} <span className="text-gray-400 font-normal">{isAr ? '(اختياري)' : '(optional)'}</span>
                  </label>
                  <Input
                    id="username"
                    type="text"
                    placeholder={isAr ? 'مثال: ahmad.ali' : 'e.g. ahmad.ali'}
                    value={form.username}
                    onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                    className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900 placeholder:text-gray-400 h-10', errors.username ? 'border-red-400' : '')}
                    disabled={submitting}
                  />
                  {errors.username && <p className="text-xs text-red-500">{errors.username}</p>}
                  {!errors.username && (
                    <p className="text-xs text-gray-400">{t('usernameOptionalNote')}</p>
                  )}
                </div>
              )}

              {/* Phone */}
              {phoneEnabled && (
                <div className="space-y-1.5 col-span-1">
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-800">
                    {phoneRequired ? (isAr ? 'رقم الهاتف' : 'Phone Number') : t('phoneOptional')} {phoneRequired && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+966 5xx xxx xxxx"
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900 placeholder:text-gray-400 h-10', errors.phone ? 'border-red-400' : '')}
                    disabled={submitting}
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>
              )}

              {/* Password */}
              <div className="space-y-1.5 col-span-1">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-800">
                  {t('password')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    className={cn('pe-10 border-gray-300 focus:border-[#57A3CC] text-gray-900 placeholder:text-gray-400 h-10', errors.password ? 'border-red-400' : '')}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 end-3 flex items-center text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(s => !s)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                {/* Strength indicator */}
                {form.password && (
                  <div className="space-y-1 pt-0.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full transition-all duration-300',
                            i <= strength.score ? strength.color : 'bg-gray-200'
                          )}
                        />
                      ))}
                    </div>
                    <p className={cn(
                      'text-xs font-semibold',
                      strength.score === 4 ? 'text-green-600' :
                      strength.score === 3 ? 'text-yellow-600' :
                      strength.score === 2 ? 'text-orange-500' : 'text-red-500'
                    )}>
                      {strength.score === 1 && t('passwordStrengthWeak')}
                      {strength.score === 2 && t('passwordStrengthFair')}
                      {strength.score === 3 && t('passwordStrengthGood')}
                      {strength.score === 4 && t('passwordStrengthStrong')}
                    </p>
                  </div>
                )}
                <p className="text-xs text-gray-400">{t('passwordHint')}</p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5 col-span-1">
                <label htmlFor="confirm_password" className="block text-sm font-semibold text-gray-800">
                  {t('confirmPassword')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.confirm_password}
                    onChange={(e) => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                    className={cn('pe-10 border-gray-300 focus:border-[#57A3CC] text-gray-900 placeholder:text-gray-400 h-10', errors.confirm_password ? 'border-red-400' : '')}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 end-3 flex items-center text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirm(s => !s)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="text-xs text-red-500">{errors.confirm_password}</p>
                )}
              </div>
            </div>

            {/* Submit & Login Link Footer */}
            <div className="pt-4 space-y-4 max-w-md mx-auto">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white border-0 h-11 font-semibold text-sm shadow-md hover:opacity-95 transition-all"
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('submitting')}</>
                ) : t('submitBtn')}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {t('alreadyHaveAccount')}{' '}
                <a href="/auth/login" className="text-[#57A3CC] font-medium hover:underline">
                  {t('signIn')}
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    )
  }
