'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  checkParentAgreement,
  acceptParentAgreement,
  AgreementCheckResult,
} from '@/lib/api/parent-agreement'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, LogOut, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

/**
 * ParentAgreementGuard
 *
 * Placed inside the parent layout (after SchoolSettingsProvider).
 * For parents: checks if they need to accept the agreement; shows acceptance form if so.
 * For students: checks if they are blocked because parent hasn't accepted.
 *
 * If the agreement is not required (plugin inactive, no linked students, already accepted),
 * renders children normally.
 */
export function ParentAgreementGuard({ children, role }: { children: React.ReactNode; role: 'parent' | 'student' }) {
  const { user, signOut } = useAuth()
  const [status, setStatus] = useState<AgreementCheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!user) return
    try {
      const res = await checkParentAgreement()
      if (res.success && res.data) {
        setStatus(res.data)
      } else {
        // If check fails, don't block — allow access
        setStatus({ must_accept: false, blocked: false })
      }
    } catch {
      setStatus({ must_accept: false, blocked: false })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleAccept = async () => {
    setAccepting(true)
    try {
      const res = await acceptParentAgreement()
      if (res.success) {
        toast.success('Agreement accepted successfully!')
        // Re-check — should now return must_accept: false
        setLoading(true)
        await fetchStatus()
      } else {
        toast.error(res.error || 'Failed to accept agreement')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setAccepting(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    )
  }

  // Parent: must accept agreement
  if (role === 'parent' && status?.must_accept && status.agreement) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <Image src="/images/logo.png" alt="iStudent.ly" fill className="object-contain" />
            </div>
            <span className="font-semibold text-brand-blue text-lg">iStudent.ly</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Agreement Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border overflow-hidden">
            {/* Title Bar */}
            <div className="bg-brand-blue px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <FileText className="text-white" size={20} />
              </div>
              <h1 className="text-xl font-bold text-white">
                {status.agreement.title}
              </h1>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              {/* Students needing acceptance */}
              {status.students_needing_acceptance && status.students_needing_acceptance.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    This agreement applies to your {status.students_needing_acceptance.length === 1 ? 'child' : 'children'}:
                  </p>
                  <ul className="text-sm text-blue-700 list-disc list-inside">
                    {status.students_needing_acceptance.map(s => (
                      <li key={s.id}>{s.first_name} {s.last_name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Agreement rich text */}
              <div
                className="prose prose-sm max-w-none text-gray-700 mb-6"
                dangerouslySetInnerHTML={{ __html: status.agreement.content }}
              />

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end border-t pt-4">
                <Button variant="outline" onClick={handleSignOut} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="gap-2 bg-brand-blue hover:bg-brand-blue/90"
                >
                  {accepting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  I Accept
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Student: blocked by parent agreement
  if (role === 'student' && status?.blocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <Image src="/images/logo.png" alt="iStudent.ly" fill className="object-contain" />
            </div>
            <span className="font-semibold text-brand-blue text-lg">iStudent.ly</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Blocked Message */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg border overflow-hidden">
            <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldAlert className="text-white" size={20} />
              </div>
              <h1 className="text-xl font-bold text-white">
                Access Restricted
              </h1>
            </div>

            <div className="px-6 py-6 text-center">
              <p className="text-gray-700 mb-6">
                {status.message || 'Your parent or guardian must accept the school agreement before you can access the system. Please ask them to log in and accept.'}
              </p>

              <Button variant="outline" onClick={handleSignOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No agreement required — render children normally
  return <>{children}</>
}
