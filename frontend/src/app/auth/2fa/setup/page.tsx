'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { beginTwoFASetup, completeTwoFASetup, skipTwoFASetup, getTwoFAStatus } from '@/lib/api/two-fa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, Copy, Check, SkipForward } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface SetupData {
  secret: string
  otpauthUrl: string
  qrCodeDataUrl: string
  recoveryCode: string
}

export default function TwoFASetupPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading, completeTwoFA } = useAuth()
  const t = useTranslations('twoFa')

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [token, setToken] = useState('')
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedRecovery, setCopiedRecovery] = useState(false)
  const [savedConfirmed, setSavedConfirmed] = useState(false)
  const [canSkip, setCanSkip] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/auth/login'); return }
    loadSetup()
  }, [authLoading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when 6 digits entered in step 2
  useEffect(() => {
    if (step === 2 && token.length === 6) handleCompleteSetup()
  }, [token, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSetup = async () => {
    setLoadingSetup(true)
    try {
      const [setupRes, statusRes] = await Promise.all([beginTwoFASetup(), getTwoFAStatus()])
      if (!setupRes.success || !setupRes.data) {
        toast.error(setupRes.error ?? t('setup_load_error'))
        return
      }
      setSetupData(setupRes.data)
      setCanSkip(statusRes.data?.setup_skippable ?? false)
    } catch {
      toast.error(t('error_generic'))
    } finally {
      setLoadingSetup(false)
    }
  }

  const dashboardUrl = () => {
    const map: Record<string, string> = {
      super_admin: '/superadmin/dashboard', admin: '/admin/dashboard',
      teacher: '/teacher/dashboard', student: '/student/dashboard',
      parent: '/parent/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard',
    }
    return map[profile?.role ?? ''] ?? '/admin/dashboard'
  }

  const handleCopySecret = async () => {
    if (!setupData) return
    await navigator.clipboard.writeText(setupData.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyRecovery = async () => {
    if (!setupData) return
    await navigator.clipboard.writeText(setupData.recoveryCode)
    setCopiedRecovery(true)
    setTimeout(() => setCopiedRecovery(false), 2000)
  }

  const handleSkip = async () => {
    setSubmitting(true)
    try {
      const res = await skipTwoFASetup()
      if (!res.success) { toast.error(res.error ?? t('skip_error')); return }
      toast.success(t('skip_success'))
      completeTwoFA()
      router.replace(dashboardUrl())
    } catch {
      toast.error(t('error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompleteSetup = async () => {
    if (!setupData || token.length !== 6) return
    setSubmitting(true)
    try {
      const res = await completeTwoFASetup(setupData.secret, token, setupData.recoveryCode)
      if (!res.success) {
        toast.error(res.error ?? t('error_invalid'))
        setToken('')
        inputRef.current?.focus()
        return
      }
      setStep(3)
    } catch {
      toast.error(t('error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDone = () => {
    if (!savedConfirmed) { toast.error(t('setup_confirm_required')); return }
    completeTwoFA()
    router.replace(dashboardUrl())
  }

  if (authLoading || loadingSetup) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-brand-blue" /></div>
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* LEFT — Branding */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-12 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-brand-blue mb-4">iStudent.ly</h1>
          <p className="text-gray-500 text-lg mb-4">{t('setup_subtitle')}</p>
          {/* Step indicators */}
          <div className="flex justify-center gap-3 mt-4">
            {([1, 2, 3] as const).map(n => (
              <div key={n} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= n ? 'bg-brand-blue text-white' : 'bg-gray-200 text-gray-400'}`}>{n}</div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {step === 1 && t('setup_step1_label')}
            {step === 2 && t('setup_step2_label')}
            {step === 3 && t('setup_step3_label')}
          </p>
          <div className="relative w-48 h-48 mx-auto mt-6">
            <Image src="/images/logo.png" alt="Studently Logo" fill className="object-contain" priority />
          </div>
        </div>
      </div>

      {/* RIGHT — Form */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center min-h-[600px] lg:min-h-screen">
        <div className="absolute inset-0 gradient-blue shadow-2xl" />
        <div className="relative z-20 w-full max-w-md px-8 py-12">

          {/* ── Step 1: QR Code ── */}
          {step === 1 && setupData && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="text-white" size={20} />
                </div>
                <h2 className="text-2xl font-bold text-white">{t('setup_step1_title')}</h2>
              </div>
              <p className="text-white/80 text-sm mb-4">{t('setup_step1_desc')}</p>

              {/* QR Code */}
              <div className="bg-white rounded-xl p-4 flex justify-center mb-4">
                <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48" />
              </div>

              {/* Manual entry */}
              <p className="text-white/60 text-xs mb-2">{t('setup_manual_entry')}</p>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 mb-6">
                <code className="text-white/90 text-xs flex-1 font-mono break-all">{setupData.secret}</code>
                <button onClick={handleCopySecret} className="text-white/60 hover:text-white transition-colors shrink-0" title={t('copy')}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep(2)} className="flex-1 h-11 bg-white text-brand-blue hover:bg-white/90 font-bold shadow-lg">
                  {t('setup_next')}
                </Button>
                {canSkip && (
                  <Button onClick={handleSkip} disabled={submitting} variant="ghost" className="h-11 text-white/70 hover:text-white hover:bg-white/10 border border-white/20 gap-1.5">
                    <SkipForward size={15} />
                    {t('setup_skip')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Verify Code ── */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="text-white" size={20} />
                </div>
                <h2 className="text-2xl font-bold text-white">{t('setup_step2_title')}</h2>
              </div>
              <p className="text-white/80 text-sm mb-6">{t('setup_step2_desc')}</p>

              <div className="space-y-5">
                <div>
                  <Label className="text-white/90 mb-1.5 block">{t('code_label')}</Label>
                  <Input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder={t('code_placeholder')}
                    value={token}
                    onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
                    className="h-14 text-center text-2xl tracking-[0.5em] bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white transition-all"
                    disabled={submitting}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setStep(1)} variant="ghost" className="h-11 text-white/70 hover:text-white hover:bg-white/10 border border-white/20">
                    {t('back')}
                  </Button>
                  <Button
                    onClick={handleCompleteSetup}
                    disabled={submitting || token.length !== 6}
                    className="flex-1 h-11 bg-white text-brand-blue hover:bg-white/90 font-bold shadow-lg"
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : t('setup_verify_btn')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Recovery Code ── */}
          {step === 3 && setupData && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="text-white" size={20} />
                </div>
                <h2 className="text-2xl font-bold text-white">{t('setup_step3_title')}</h2>
              </div>
              <p className="text-white/80 text-sm mb-4">{t('setup_step3_desc')}</p>
              <p className="text-yellow-300 text-xs mb-4">{t('setup_step3_warning')}</p>

              {/* Recovery code display */}
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-4 mb-6">
                <code className="text-white text-lg font-mono font-bold flex-1 tracking-widest text-center">{setupData.recoveryCode}</code>
                <button onClick={handleCopyRecovery} className="text-white/60 hover:text-white transition-colors" title={t('copy')}>
                  {copiedRecovery ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mb-6">
                <input
                  type="checkbox"
                  checked={savedConfirmed}
                  onChange={e => setSavedConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-white cursor-pointer"
                />
                <span className="text-white/80 text-sm">{t('setup_saved_confirm')}</span>
              </label>

              <Button
                onClick={handleDone}
                disabled={!savedConfirmed}
                className="w-full h-12 bg-white text-brand-blue hover:bg-white/90 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
              >
                {t('setup_done')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
