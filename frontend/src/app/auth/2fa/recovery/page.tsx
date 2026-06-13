'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { submitRecoveryCode } from '@/lib/api/two-fa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function TwoFARecoveryPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading, completeTwoFA } = useAuth()
  const t = useTranslations('twoFa')

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/auth/login'); return }
  }, [authLoading, user, router])

  const dashboardUrl = () => {
    const map: Record<string, string> = {
      super_admin: '/superadmin/dashboard', admin: '/admin/dashboard',
      teacher: '/teacher/dashboard', student: '/student/dashboard',
      parent: '/parent/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard',
    }
    return map[profile?.role ?? ''] ?? '/admin/dashboard'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { toast.error(t('recovery_required')); return }
    setSubmitting(true)
    try {
      const res = await submitRecoveryCode(code.trim())
      if (!res.success) {
        toast.error(res.error ?? t('recovery_invalid'))
        return
      }
      toast.success(t('recovery_success'))
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
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-12 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-brand-blue mb-4">iStudent.ly</h1>
          <p className="text-gray-500 text-lg mb-8">{t('recovery_subtitle')}</p>
          <div className="relative w-64 h-64 mx-auto">
            <Image src="/images/logo.png" alt="Studently Logo" fill className="object-contain" priority />
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 relative flex items-center justify-center min-h-[600px] lg:min-h-screen">
        <div className="absolute inset-0 gradient-blue shadow-2xl" />
        <div className="relative z-20 w-full max-w-md px-8 py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <KeyRound className="text-white" size={20} />
            </div>
            <h2 className="text-3xl font-bold text-white">{t('recovery_title')}</h2>
          </div>

          <p className="text-white/80 text-sm mb-2">{t('recovery_desc')}</p>
          <p className="text-white/60 text-xs mb-6">{t('recovery_warning')}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-white/90 mb-1.5 block">{t('recovery_label')}</Label>
              <Input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                className="h-12 text-center font-mono tracking-widest bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white transition-all"
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || !code.trim()}
              className="w-full h-12 bg-white text-brand-blue hover:bg-white/90 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
            >
              {submitting ? <Loader2 className="animate-spin" /> : t('recovery_btn')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
