'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
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
    phone: '',
    password: '',
    confirm_password: '',
  })
  const [extraFields, setExtraFields] = React.useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<typeof form>>({})
  const [submitting, setSubmitting] = React.useState(false)

  const strength = passwordStrength(form.password)

  // Load link info on mount
  React.useEffect(() => {
    if (!token) { setPageState('invalid'); setInvalidReason('link_not_found'); return }

    getSignupLinkInfo(token).then((res) => {
      if (res.success && res.data) {
        setLinkInfo(res.data)
        // Pre-fill extra fields from admin-specified prefill_data
        if (res.data.prefill_data && typeof res.data.prefill_data === 'object') {
          const prefill: Record<string, string> = {}
          for (const [k, v] of Object.entries(res.data.prefill_data)) {
            if (v !== null && v !== undefined) prefill[k] = String(v)
          }
          setExtraFields(prefill)
        }
        setPageState('form')
      } else {
        setInvalidReason(res.error ?? 'invalid_link')
        setPageState('invalid')
      }
    })
  }, [token])

  const validate = (): boolean => {
    const errs: Partial<typeof form> = {}
    if (!form.first_name.trim() || form.first_name.trim().length < 2) errs.first_name = t('firstName') + ' is required'
    if (!form.last_name.trim() || form.last_name.trim().length < 2) errs.last_name = t('lastName') + ' is required'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('email') + ' is invalid'
    if (!form.password || form.password.length < 8) errs.password = t('passwordHint')
    if (form.password !== form.confirm_password) errs.confirm_password = t('passwordMismatch')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const submittedExtra = Object.fromEntries(
        Object.entries(extraFields).filter(([, v]) => v.trim() !== '')
      )
      const res = await submitSignup({
        token,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        confirm_password: form.confirm_password,
        extra_fields: Object.keys(submittedExtra).length > 0 ? submittedExtra : undefined,
      })

      if (res.success) {
        setPageState('success')
      } else {
        const errKey = res.error ?? ''
        if (errKey === 'email_already_registered') {
          setErrors({ email: t('emailAlreadyRegistered') })
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
      className="min-h-screen flex items-center justify-center bg-gray-50 p-4 py-8"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header band */}
          <div className="bg-gradient-to-r from-[#57A3CC] to-[#022172] p-6 text-center">
            {linkInfo?.school_logo_url ? (
              <img
                src={linkInfo.school_logo_url}
                alt={linkInfo.school_name}
                className="w-16 h-16 rounded-xl mx-auto mb-3 object-contain bg-white p-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl mx-auto mb-3 bg-white/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {(linkInfo?.school_name ?? 'S').charAt(0)}
                </span>
              </div>
            )}
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
                  {t('firstName')} <span className="text-red-500">*</span>
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
                  {t('lastName')} <span className="text-red-500">*</span>
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

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-800">
                {t('email')} <span className="text-red-500">*</span>
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
            </div>

            {/* Phone (optional) */}
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-800">
                {t('phoneOptional')}
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+966 5xx xxx xxxx"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                className="border-gray-300 focus:border-[#57A3CC] text-gray-900! placeholder:text-gray-400"
                disabled={submitting}
              />
            </div>

            {/* Role-specific extra fields */}
            {linkInfo?.role === 'student' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-800">
                  Grade Level
                </label>
                <input
                  type="text"
                  placeholder="e.g. Grade 5"
                  value={extraFields.grade_level ?? ''}
                  onChange={e => setExtraFields(f => ({ ...f, grade_level: e.target.value }))}
                  disabled={submitting}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:border-[#57A3CC] focus:outline-none focus:ring-1 focus:ring-[#57A3CC] placeholder:text-gray-400 text-gray-900"
                />
              </div>
            )}
            {['teacher', 'staff', 'librarian', 'counselor'].includes(linkInfo?.role ?? '') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-800">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={extraFields.department ?? ''}
                    onChange={e => setExtraFields(f => ({ ...f, department: e.target.value }))}
                    disabled={submitting}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:border-[#57A3CC] focus:outline-none focus:ring-1 focus:ring-[#57A3CC] placeholder:text-gray-400 text-gray-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-800">Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Math Teacher"
                    value={extraFields.job_title ?? ''}
                    onChange={e => setExtraFields(f => ({ ...f, job_title: e.target.value }))}
                    disabled={submitting}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:border-[#57A3CC] focus:outline-none focus:ring-1 focus:ring-[#57A3CC] placeholder:text-gray-400 text-gray-900"
                  />
                </div>
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
