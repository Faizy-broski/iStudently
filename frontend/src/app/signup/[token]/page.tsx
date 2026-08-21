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
  const hasPoster = !!linkInfo?.meta?.poster_url

  return (
    <div
      className={cn(
        "min-h-screen bg-gray-50",
        hasPoster ? "flex" : "flex items-center justify-center p-4 py-8"
      )}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <LanguageToggle />
      {/* Poster Side */}
      {hasPoster && (
        <div className="hidden lg:flex lg:w-1/2 relative bg-gray-900 border-e border-gray-200">
          <img 
            src={linkInfo.meta!.poster_url!} 
            alt="Signup Poster" 
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-12 left-12 right-12 text-white">
            <h2 className="text-4xl font-bold mb-2">{linkInfo.school_name}</h2>
            {linkInfo.meta?.description && (
              <p className="text-lg text-white/80 max-w-lg">{linkInfo.meta.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Form Side */}
      <div className={cn(
        "w-full",
        hasPoster ? "lg:w-1/2 flex items-center justify-center p-6 sm:p-12" : "max-w-md"
      )}>
        <div className={cn(
          "bg-white overflow-hidden",
          hasPoster ? "w-full max-w-lg shadow-sm rounded-2xl border border-gray-100" : "rounded-2xl shadow-lg border border-gray-100"
        )}>
          {/* Header band */}
          <div className="bg-gradient-to-r from-[#57A3CC] to-[#022172] p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-1">
              {linkInfo?.expires_at && (
                <div className="bg-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded backdrop-blur-sm">
                  {t('expires')}: {new Date(linkInfo.expires_at).toLocaleDateString()}
                </div>
              )}
              {linkInfo?.available_seats !== null && linkInfo?.available_seats !== undefined && (
                <div className="bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm">
                  {linkInfo.available_seats} {t('seatsLeft', { fallback: 'seats left' })}
                </div>
              )}
            </div>

            <SchoolLogo
              logoUrl={linkInfo?.school_logo_url}
              alt={linkInfo?.school_name ?? 'School'}
              shape={linkInfo?.logo_shape}
              borderWidth={linkInfo?.logo_border_width}
              borderColor={linkInfo?.logo_border_color}
              size={64}
              className="mx-auto mb-3"
              fallback={
                <span className="text-2xl font-bold text-[#022172]">
                  {(linkInfo?.school_name ?? 'S').charAt(0)}
                </span>
              }
            />
            <h1 className="text-xl font-bold text-white">{linkInfo?.school_name}</h1>
            {linkInfo?.label && (
              <p className="text-white/70 text-sm mt-0.5">{linkInfo.label}</p>
            )}
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-white/70 text-sm">{t('invitedAs')}</span>
              {linkInfo?.role && (
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', ROLE_COLORS[linkInfo.role] ?? 'bg-white/20 text-white')}>
                  {linkInfo.role}
                </span>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 text-center">{t('formTitle')}</h2>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="first_name" className="block text-sm font-semibold text-gray-800">
                  {t('firstName')} {firstNameRequired && <span className="text-red-500">*</span>}
                </label>
                <Input
                  id="first_name"
                  placeholder="Ahmad"
                  value={form.first_name}
                  onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                  className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400', errors.first_name ? 'border-red-400' : '')}
                  disabled={submitting}
                />
                {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="last_name" className="block text-sm font-semibold text-gray-800">
                  {t('lastName')} {lastNameRequired && <span className="text-red-500">*</span>}
                </label>
                <Input
                  id="last_name"
                  placeholder="Ali"
                  value={form.last_name}
                  onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                  className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400', errors.last_name ? 'border-red-400' : '')}
                  disabled={submitting}
                />
                {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
              </div>
            </div>

            {/* Custom Fields */}
            {linkInfo?.meta?.custom_fields?.map(field => (
              <div key={field.id} className="space-y-1.5">
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
                    <SelectTrigger className={cn('w-full border-gray-300 focus:ring-[#57A3CC]', (errors as any).extra_fields?.[field.id] ? 'border-red-400' : '')}>
                      <SelectValue placeholder={field.placeholder || 'Select...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'multi-select' ? (
                  <div className={cn('space-y-1.5 rounded-md border p-2', (errors as any).extra_fields?.[field.id] ? 'border-red-400' : 'border-gray-300')}>
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
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
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
                    className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900!', (errors as any).extra_fields?.[field.id] ? 'border-red-400' : '')}
                    disabled={submitting}
                  />
                )}
                {(errors as any).extra_fields?.[field.id] && <p className="text-xs text-red-500">{(errors as any).extra_fields[field.id]}</p>}
              </div>
            ))}

            {/* Email */}
            {emailEnabled && (
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-800">
                  {t('email')} <span className="text-gray-400 font-normal">{isAr ? '(اختياري)' : '(optional)'}</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400', errors.email ? 'border-red-400' : '')}
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
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-sm font-semibold text-gray-800">
                  {t('username')} <span className="text-gray-400 font-normal">{isAr ? '(اختياري)' : '(optional)'}</span>
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder={isAr ? 'مثال: ahmad.ali' : 'e.g. ahmad.ali'}
                  value={form.username}
                  onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                  className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400', errors.username ? 'border-red-400' : '')}
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
              <div className="space-y-1.5">
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-800">
                  {phoneRequired ? (isAr ? 'رقم الهاتف' : 'Phone Number') : t('phoneOptional')} {phoneRequired && <span className="text-red-500">*</span>}
                </label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+966 5xx xxx xxxx"
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  className={cn('border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400', errors.phone ? 'border-red-400' : '')}
                  disabled={submitting}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>
            )}

            {/* Password */}
            <div className="space-y-1.5">
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
                  className={cn('pe-10 border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400', errors.password ? 'border-red-400' : '')}
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
            <div className="space-y-1.5">
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
                  className={cn('pe-10 border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400', errors.confirm_password ? 'border-red-400' : '')}
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

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white border-0 h-10 font-semibold"
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
          </form>
        </div>
      </div>
    </div>
  )
}
