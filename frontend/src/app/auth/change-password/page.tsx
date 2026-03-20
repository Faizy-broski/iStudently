'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import { changePassword } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { user, profile, loading: authLoading, mustChangePassword } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Redirect away if not authenticated or not required to change password
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login')
      return
    }
    // Once password has been changed (flag cleared), redirect to dashboard
    if (profile && !mustChangePassword) {
      const dashboardMap: Record<string, string> = {
        super_admin: '/superadmin/dashboard',
        admin: '/admin/dashboard',
        teacher: '/teacher/dashboard',
        student: '/student/dashboard',
        parent: '/parent/dashboard',
        librarian: '/librarian/dashboard',
        staff: '/staff/dashboard',
      }
      router.replace(dashboardMap[profile.role] ?? '/admin/dashboard')
    }
  }, [authLoading, user, profile, mustChangePassword, router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await changePassword(newPassword)
      if (!res.success) {
        toast.error(res.error ?? 'Failed to change password')
        return
      }
      toast.success('Password changed successfully!')
      // AuthContext will detect force_password_change = false on next profile refresh
      // and the useEffect above will handle the redirect
      // Force a page reload so AuthContext re-fetches the profile with the cleared flag
      window.location.href =
        profile
          ? ({
              super_admin: '/superadmin/dashboard',
              admin: '/admin/dashboard',
              teacher: '/teacher/dashboard',
              student: '/student/dashboard',
              parent: '/parent/dashboard',
              librarian: '/librarian/dashboard',
              staff: '/staff/dashboard',
            }[profile.role] ?? '/admin/dashboard')
          : '/auth/login'
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">

      {/* LEFT — Branding */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-12 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-brand-blue mb-4">
            iStudent.ly
          </h1>
          <p className="text-gray-500 text-lg mb-8">
            Please set a new password to continue.
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

      {/* RIGHT — Form */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center min-h-[600px] lg:min-h-screen">
        <div className="absolute inset-0 gradient-blue shadow-2xl" />

        <div className="relative z-20 w-full max-w-md px-8 py-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <KeyRound className="text-white" size={20} />
            </div>
            <h2 className="text-3xl font-bold text-white">Change Password</h2>
          </div>

          <p className="text-white/80 text-sm mb-6">
            Your administrator requires you to set a new password before accessing the system.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* New Password */}
            <div>
              <Label className="text-white/90 mb-1.5 block">New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 focus:border-white transition-all pr-10"
                  required
                  disabled={submitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <Label className="text-white/90 mb-1.5 block">Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 focus:border-white transition-all pr-10"
                  required
                  disabled={submitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Strength indicator */}
            {newPassword.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        newPassword.length >= level * 3
                          ? level <= 1 ? 'bg-red-400'
                          : level <= 2 ? 'bg-orange-400'
                          : level <= 3 ? 'bg-yellow-400'
                          : 'bg-green-400'
                          : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-white/60">
                  {newPassword.length < 4 ? 'Too short' :
                   newPassword.length < 7 ? 'Weak' :
                   newPassword.length < 10 ? 'Fair' :
                   newPassword.length < 13 ? 'Good' : 'Strong'}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-white text-brand-blue hover:bg-white/90 font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
            >
              {submitting ? <Loader2 className="animate-spin" /> : 'Set New Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
