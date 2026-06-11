'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { checkUserAgreement, acceptUserAgreement, rejectUserAgreement } from '@/lib/api/user-agreement'
import { AgreementModal } from './AgreementModal'
import { Button } from '@/components/ui/button'
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react'
import Image from 'next/image'
import type { RoleAgreementConfig, LinkedStudent } from '@/lib/api/user-agreement'

// Roles subject to agreement gating (admins are excluded — they configure, not be gated)
const GATED_ROLES = new Set(['teacher', 'student', 'parent', 'staff', 'librarian', 'counselor'])

interface AgreementGateProps {
  children: React.ReactNode
}

type GateState =
  | { status: 'loading' }
  | { status: 'clear' }
  | { status: 'show_agreement'; agreement: RoleAgreementConfig; students?: LinkedStudent[] }
  | { status: 'blocked'; message: string }

export function AgreementGate({ children }: AgreementGateProps) {
  const { profile, loading, signOut } = useAuth()
  const [gate, setGate] = useState<GateState>({ status: 'loading' })
  const [signingOut, setSigningOut] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (loading || !profile) return

    if (!GATED_ROLES.has(profile.role)) {
      setGate({ status: 'clear' })
      return
    }

    // Already accepted in this session — skip API call
    if (profile.agreement_status === 'accepted') {
      setGate({ status: 'clear' })
      return
    }

    // Prevent duplicate checks on re-renders
    if (checkedRef.current) return
    checkedRef.current = true

    checkUserAgreement().then(res => {
      // Account inactive due to prior rejection — sign out and redirect
      if (!res.success && res.code === 'AGREEMENT_REJECTED') {
        signOut().then(() => {
          window.location.href = '/auth/login?error=agreement_rejected'
        })
        return
      }

      if (!res.success || !res.data) {
        setGate({ status: 'clear' }) // On API error, let user through
        return
      }

      const { must_accept, blocked, message, agreement, students_needing_acceptance } = res.data

      if (blocked) {
        setGate({ status: 'blocked', message: message || 'Your parent or guardian must accept the school agreement before you can access the system.' })
        return
      }

      if (must_accept && agreement) {
        setGate({ status: 'show_agreement', agreement, students: students_needing_acceptance })
        return
      }

      setGate({ status: 'clear' })
    }).catch(() => {
      setGate({ status: 'clear' }) // Network error — don't block
    })
  }, [loading, profile, signOut])

  const handleAccept = async () => {
    await acceptUserAgreement()
    if (profile) profile.agreement_status = 'accepted'
    setGate({ status: 'clear' })
  }

  const handleReject = async () => {
    await rejectUserAgreement()
    await signOut()
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
  }

  // ── Still checking ────────────────────────────────────────────────────────
  if (gate.status === 'loading') {
    return <>{children}</>
  }

  // ── Agreement popup ───────────────────────────────────────────────────────
  if (gate.status === 'show_agreement') {
    return (
      <>
        {children}
        <AgreementModal
          title={gate.agreement.title}
          content={gate.agreement.content}
          studentsNeedingAcceptance={gate.students}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      </>
    )
  }

  // ── Student blocked by parent ─────────────────────────────────────────────
  if (gate.status === 'blocked') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        {/* Minimal header */}
        <div className="bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <Image src="/images/logo.png" alt="iStudent.ly" fill className="object-contain" />
            </div>
            <span className="font-semibold text-brand-blue dark:text-white text-lg">iStudent.ly</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
            className="gap-2"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign Out
          </Button>
        </div>

        {/* Blocked message */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-lg border overflow-hidden">
            <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldAlert className="text-white" size={20} />
              </div>
              <h1 className="text-xl font-bold text-white">Access Restricted</h1>
            </div>

            <div className="px-6 py-6 text-center space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                {gate.message}
              </p>
              <Button
                variant="outline"
                onClick={handleSignOut}
                disabled={signingOut}
                className="gap-2"
              >
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Clear ─────────────────────────────────────────────────────────────────
  return <>{children}</>
}
