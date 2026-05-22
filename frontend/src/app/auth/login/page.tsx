'use client'

import { useState, useEffect, FormEvent, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { API_URL } from '@/config/api'
import { useTranslations, useLocale } from 'next-intl'

interface SocialLoginConfig {
  google_enabled: boolean
  microsoft_enabled: boolean
  school_id?: string | null
}

// ---------------------------------------------------------------------------
// Language toggle button — sets cookie via API route then reloads
// ---------------------------------------------------------------------------
function LanguageToggle() {
  const locale = useLocale()
  const [switching, setSwitching] = useState(false)

  async function toggle() {
    const next = locale === 'en' ? 'ar' : 'en'
    setSwitching(true)
    try {
      await fetch('/api/set-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      })
      window.location.reload()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={switching}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-xs font-semibold hover:bg-white/25 transition-all disabled:opacity-60 select-none"
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

// ---------------------------------------------------------------------------

function LoginForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const { signIn, profile, user, loading: authLoading, mustChangePassword } = useAuth()
  const t = useTranslations('login')

  // Animation States
  const [isExpanded, setIsExpanded] = useState(false)
  const [showContent, setShowContent] = useState(false)

  // Form States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [justLoggedIn, setJustLoggedIn] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [countdown, setCountdown] = useState(3)

  // Social login
  const [socialConfig, setSocialConfig] = useState<SocialLoginConfig | null>(null)
  const [socialLoading, setSocialLoading] = useState(false)

  const error = searchParams.get('error')

  // Redirect already logged-in users
  useEffect(() => {
    if (error) return
    if (authLoading) return
    if (user && profile?.role) {
      if (mustChangePassword) {
        router.replace('/auth/change-password')
        return
      }
      const dashboardMap: Record<string, string> = {
        'super_admin': '/superadmin/dashboard',
        'admin': '/admin/dashboard',
        'teacher': '/teacher/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
        'librarian': '/librarian/dashboard',
        'staff': '/staff/dashboard',
      }
      router.replace(dashboardMap[profile.role] || '/admin/dashboard')
    }
  }, [user, profile, authLoading, error, mustChangePassword, router])

  // Load saved credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('studentlyRememberEmail')
    const savedPassword = localStorage.getItem('studentlyRememberPassword')
    if (savedEmail && savedPassword) {
      setEmail(savedEmail)
      setPassword(savedPassword)
      setRememberMe(true)
    }
  }, [])

  // Fetch social login config
  useEffect(() => {
    fetch(`${API_URL}/public/social-login-config`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) setSocialConfig(result.data)
      })
      .catch(() => {})
  }, [])

  // Trigger animations on mount
  useEffect(() => {
    const t1 = setTimeout(() => setIsExpanded(true), 100)
    const t2 = setTimeout(() => setShowContent(true), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Watch for profile update after login
  useEffect(() => {
    if (!justLoggedIn || !user) return

    if (profile?.role) {
      if (mustChangePassword) {
        router.push('/auth/change-password')
        setLoading(false)
        return
      }

      const dashboardMap: Record<string, string> = {
        'super_admin': '/superadmin/dashboard',
        'admin': '/admin/dashboard',
        'teacher': '/teacher/dashboard',
        'student': '/student/dashboard',
        'parent': '/parent/dashboard',
        'librarian': '/librarian/dashboard',
        'staff': '/staff/dashboard',
      }

      const dashboardUrl = dashboardMap[profile.role] || '/auth/login?error=role_not_supported'
      setRedirecting(true)
      setCountdown(3)

      toast.success('Welcome To iStudent.ly!', {
        description: 'Redirecting to your dashboard...',
        duration: 3000,
      })

      let count = 3
      const interval = setInterval(() => {
        count -= 1
        setCountdown(count)
        if (count <= 0) {
          clearInterval(interval)
          router.push(dashboardUrl)
        }
      }, 1000)

      setLoading(false)
    } else if (user && !profile) {
      const timeout = setTimeout(() => {
        if (!profile) {
          setLoading(false)
          setJustLoggedIn(false)
        }
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [justLoggedIn, profile, user, router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (authLoading || (user && profile)) return

    setLoading(true)
    setJustLoggedIn(false)

    try {
      await signIn(email, password)

      if (rememberMe) {
        localStorage.setItem('studentlyRememberEmail', email)
        localStorage.setItem('studentlyRememberPassword', password)
      } else {
        localStorage.removeItem('studentlyRememberEmail')
        localStorage.removeItem('studentlyRememberPassword')
      }

      setJustLoggedIn(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid email or password'
      toast.error(errorMessage)
      setLoading(false)
      setJustLoggedIn(false)
    }
  }

  const handleSocialLogin = useCallback(async (provider: 'google' | 'microsoft') => {
    if (!socialConfig?.school_id) {
      toast.error('Social login is not available')
      return
    }
    setSocialLoading(true)
    const oauthUrl = `${API_URL}/auth/social/${provider}?school_id=${encodeURIComponent(socialConfig.school_id)}`
    window.location.href = oauthUrl
  }, [socialConfig])

  const anim = (delay: string) => `
    transform transition-all duration-700 ease-out ${delay}
    ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
  `

  // RTL when Arabic
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden" dir={dir}>

      {/* LEFT: Branding */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-12 relative z-10">
        <div className={`text-center transition-all duration-1000 delay-300 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-4xl lg:text-5xl font-bold text-brand-blue mb-4">
            {t('title')}
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            {t('subtitle')}
          </p>
          <div className="relative w-64 h-64 mx-auto">
            <Image
              src="/images/logo.png"
              alt="Studently Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>

      {/* RIGHT: Form */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center min-h-[600px] lg:min-h-screen">

        {/* Animated background bubble */}
        <div
          className="absolute inset-0 gradient-blue shadow-2xl"
          style={{
            clipPath: isExpanded ? 'circle(150% at 100% 50%)' : 'circle(0% at 100% 50%)',
            transition: 'clip-path 1.2s cubic-bezier(0.77, 0, 0.175, 1)',
          }}
        />

        <div
          className="absolute inset-y-0 left-0 w-1 bg-white/20 hidden lg:block"
          style={{ opacity: isExpanded ? 1 : 0, transition: 'opacity 1s delay-500' }}
        />

        {/* Form container */}
        <div className="relative z-20 w-full max-w-md px-8 py-12">

          <h2 className={`text-3xl font-bold text-white mb-8 text-center lg:text-start ${anim('delay-100')}`}>
            {t('heading')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Error messages */}
            {error === 'account_inactive' && (
              <div className={`p-3 rounded-lg bg-red-500/20 border border-red-400/30 ${anim('delay-150')}`}>
                <p className="text-sm text-white">{t('err_inactive')}</p>
              </div>
            )}
            {error === 'unauthorized' && (
              <div className={`p-3 rounded-lg bg-red-500/20 border border-red-400/30 ${anim('delay-150')}`}>
                <p className="text-sm text-white">{t('err_unauthorized')}</p>
              </div>
            )}
            {error === 'role_not_supported' && (
              <div className={`p-3 rounded-lg bg-red-500/20 border border-red-400/30 ${anim('delay-150')}`}>
                <p className="text-sm text-white">{t('err_role')}</p>
              </div>
            )}

            {/* Email or Username */}
            <div className={anim('delay-200')}>
              <Label className="text-white/90 mb-1.5 block">{t('label_email_or_username')}</Label>
              <Input
                type="text"
                placeholder={t('placeholder_email_or_username')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 focus:border-white transition-all"
                required
                disabled={loading || authLoading}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className={anim('delay-300')}>
              <Label className="text-white/90 mb-1.5 block">{t('label_password')}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 focus:border-white transition-all pr-10"
                  required
                  disabled={loading || authLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-blue-900/70 hover:text-blue-900 dark:text-white/90 dark:hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember me + Language toggle */}
            <div className={`flex items-center justify-between gap-2 ${anim('delay-350')}`}>
              <div className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(checked) => { if (!loading && !authLoading) setRememberMe(!!checked) }}
                  disabled={loading || authLoading}
                  className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-brand-blue"
                />
                <span
                  className="text-sm text-white/90 select-none"
                  onClick={() => { if (!loading && !authLoading) setRememberMe(r => !r) }}
                >
                  {t('remember_me')}
                </span>
              </div>
              <LanguageToggle />
            </div>

            {/* Sign In button */}
            <div className={anim('delay-400')}>
              <Button
                type="submit"
                disabled={loading || authLoading || redirecting}
                className="w-full h-12 bg-white text-brand-blue hover:bg-white/90 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-70"
              >
                {redirecting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" />
                    {t('btn_redirecting', { count: countdown })}
                  </span>
                ) : loading || authLoading ? (
                  <Loader2 className="animate-spin" />
                ) : t('btn_sign_in')}
              </Button>
            </div>

            {/* Social login */}
            {(socialConfig?.google_enabled || socialConfig?.microsoft_enabled) && (
              <div className={anim('delay-500')}>
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-white/20" />
                  <span className="text-xs text-white/60 uppercase tracking-wide">{t('or')}</span>
                  <div className="flex-1 h-px bg-white/20" />
                </div>
                <div className="space-y-2.5">
                  {socialConfig.google_enabled && (
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('google')}
                      disabled={loading || authLoading || socialLoading}
                      className="w-full h-11 flex items-center justify-center gap-2.5 bg-white/10 border border-white/20 rounded-md text-white text-sm font-medium hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {socialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      )}
                      {t('google')}
                    </button>
                  )}
                  {socialConfig.microsoft_enabled && (
                    <button
                      type="button"
                      onClick={() => handleSocialLogin('microsoft')}
                      disabled={loading || authLoading || socialLoading}
                      className="w-full h-11 flex items-center justify-center gap-2.5 bg-white/10 border border-white/20 rounded-md text-white text-sm font-medium hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {socialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <svg className="h-4.5 w-4.5" viewBox="0 0 23 23">
                          <rect fill="#F25022" x="1" y="1" width="10" height="10" />
                          <rect fill="#00A4EF" x="1" y="12" width="10" height="10" />
                          <rect fill="#7FBA00" x="12" y="1" width="10" height="10" />
                          <rect fill="#FFB900" x="12" y="12" width="10" height="10" />
                        </svg>
                      )}
                      {t('microsoft')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <p className={`text-center text-white/70 text-sm mt-6 ${anim('delay-600')}`}>
              {t('contact_admin')}
            </p>

          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
