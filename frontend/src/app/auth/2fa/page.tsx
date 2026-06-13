'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { verifyTwoFA } from '@/lib/api/two-fa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function TwoFAVerifyPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading, mustCompleteTwoFA, completeTwoFA } = useAuth()
  const t = useTranslations('twoFa')

  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/auth/login'); return }
    inputRef.current?.focus()
  }, [authLoading, user, router])

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (token.length === 6) handleSubmit()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const dashboardUrl = () => {
    const map: Record<string, string> = {
      super_admin: '/superadmin/dashboard', admin: '/admin/dashboard',
      teacher: '/teacher/dashboard', student: '/student/dashboard',
      parent: '/parent/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard',
    }
    return map[profile?.role ?? ''] ?? '/admin/dashboard'
  }

  const handleSubmit = async () => {
    if (token.length !== 6) { toast.error(t('error_6_digits')); return }
    setSubmitting(true)
    try {
      const res = await verifyTwoFA(token)
      if (!res.success) {
        toast.error(res.error ?? t('error_invalid'))
        setToken('')
        inputRef.current?.focus()
        return
      }
      toast.success(t('verified'))
      completeTwoFA()
      router.replace(dashboardUrl())
    } catch {
      toast.error(t('error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-brand-blue" /></div>
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* LEFT — Branding */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-12 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-brand-blue mb-4">iStudent.ly</h1>
          <p className="text-gray-500 text-lg mb-8">{t('verify_subtitle')}</p>
          <div className="relative w-64 h-64 mx-auto">
            <Image src="/images/logo.png" alt="Studently Logo" fill className="object-contain" priority />
          </div>
        </div>
      </div>

      {/* RIGHT — Form */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center min-h-[600px] lg:min-h-screen">
        <div className="absolute inset-0 gradient-blue shadow-2xl" />
        <div className="relative z-20 w-full max-w-md px-8 py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <h2 className="text-3xl font-bold text-white">{t('verify_title')}</h2>
          </div>

          <p className="text-white/80 text-sm mb-6">{t('verify_desc')}</p>

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
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || token.length !== 6}
              className="w-full h-12 bg-white text-brand-blue hover:bg-white/90 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
            >
              {submitting ? <Loader2 className="animate-spin" /> : t('verify_btn')}
            </Button>

            <p className="text-center text-white/60 text-sm">
              {t('lost_device')}{' '}
              <Link href="/auth/2fa/recovery" className="text-white underline hover:text-white/80">
                {t('use_recovery')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
