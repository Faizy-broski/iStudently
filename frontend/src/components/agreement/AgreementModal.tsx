'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, FileText, X, Users } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { LinkedStudent } from '@/lib/api/user-agreement'

interface AgreementModalProps {
  title: string
  content: string
  /** Parent role only: list of children this acceptance covers */
  studentsNeedingAcceptance?: LinkedStudent[]
  onAccept: () => Promise<void>
  onReject: () => Promise<void>
}

export function AgreementModal({
  title,
  content,
  studentsNeedingAcceptance,
  onAccept,
  onReject,
}: AgreementModalProps) {
  const [read, setRead]                       = useState(false)
  const [accepting, setAccepting]             = useState(false)
  const [rejecting, setRejecting]             = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)

  const handleAccept = async () => {
    if (!read) return
    setAccepting(true)
    try { await onAccept() } finally { setAccepting(false) }
  }

  const handleRejectConfirmed = async () => {
    setRejecting(true)
    try { await onReject() } finally { setRejecting(false); setShowRejectConfirm(false) }
  }

  const hasStudents = (studentsNeedingAcceptance?.length ?? 0) > 0

  return (
    <>
      {/* Full-screen overlay — intentionally not dismissible */}
      <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
              <p className="text-xs text-muted-foreground">Please read the agreement before proceeding</p>
            </div>
          </div>

          {/* Linked students notice (parent only) */}
          {hasStudents && (
            <div className="mx-6 mt-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg shrink-0">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    This agreement applies to {studentsNeedingAcceptance!.length === 1 ? 'your child' : 'your children'}:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {studentsNeedingAcceptance!.map(s => (
                      <li key={s.id} className="text-sm text-blue-700 dark:text-blue-300">
                        • {s.first_name} {s.last_name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Accepting this agreement will grant {studentsNeedingAcceptance!.length === 1 ? 'them' : 'all of them'} access to the student portal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable agreement body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-4">
            {/* Read confirmation checkbox */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <Checkbox
                id="agreement-read"
                checked={read}
                onCheckedChange={v => setRead(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I have read and understand the agreement above
              </span>
            </label>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowRejectConfirm(true)}
                disabled={accepting || rejecting}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reject
              </Button>
              <Button
                onClick={handleAccept}
                disabled={!read || accepting || rejecting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasStudents ? 'Accept for All Children' : 'Accept Agreement'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Reject confirmation dialog */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent className="z-10000">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-500" />
              Reject Agreement?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  If you reject this agreement, your account will be{' '}
                  <strong className="text-foreground">immediately deactivated</strong> and you will be signed out.
                </p>
                {hasStudents && (
                  <p className="text-amber-700 dark:text-amber-400">
                    Your {studentsNeedingAcceptance!.length === 1 ? 'child' : 'children'} will also lose access to the student portal until you accept.
                  </p>
                )}
                <p>
                  To regain access later, visit the reactivation page, enter your email, and accept the agreement on your next login.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirmed}
              disabled={rejecting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Reject & Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
