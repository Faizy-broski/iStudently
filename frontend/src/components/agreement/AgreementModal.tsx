'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, FileText, X, Users } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { AgreementItem, LinkedStudent } from '@/lib/api/user-agreement'

interface AgreementModalProps {
  agreements: AgreementItem[]
  /** Parent role only: list of children this acceptance covers */
  studentsNeedingAcceptance?: LinkedStudent[]
  onAccept: () => Promise<void>
  onReject: () => Promise<void>
}

export function AgreementModal({
  agreements,
  studentsNeedingAcceptance,
  onAccept,
  onReject,
}: AgreementModalProps) {
  const [read, setRead]                       = useState(false)
  const [accepting, setAccepting]             = useState(false)
  const [rejecting, setRejecting]             = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  // Shown when the user taps Accept before checking the confirmation box —
  // otherwise the reason the button "doesn't do anything" isn't obvious.
  const [showCheckHint, setShowCheckHint]     = useState(false)
  const checkboxLabelRef = useRef<HTMLLabelElement>(null)

  const handleAccept = async () => {
    if (!read) {
      setShowCheckHint(true)
      checkboxLabelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setShowCheckHint(false)
    setAccepting(true)
    try { await onAccept() } finally { setAccepting(false) }
  }

  const handleRejectConfirmed = async () => {
    setRejecting(true)
    try { await onReject() } finally { setRejecting(false); setShowRejectConfirm(false) }
  }

  const hasStudents = (studentsNeedingAcceptance?.length ?? 0) > 0
  const multiple = agreements.length > 1

  const headerTitle = multiple
    ? `Review Agreements (${agreements.length}) / مراجعة الاتفاقيات (${agreements.length})`
    : (agreements[0]?.title || 'School Agreement / اتفاقية المدرسة')

  return (
    <>
      {/* Full-screen overlay — intentionally not dismissible */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{headerTitle}</h2>
              <p className="text-xs text-muted-foreground">
                {multiple
                  ? 'Please read all agreements carefully before proceeding / يرجى قراءة جميع الاتفاقيات بعناية قبل المتابعة'
                  : 'Please read the agreement before proceeding / يرجى قراءة الاتفاقية بعناية قبل المتابعة'}
              </p>
            </div>
          </div>

          {/* Linked students notice (parent only) */}
          {hasStudents && (
            <div className="mx-6 mt-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg shrink-0">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {multiple ? 'These agreements apply' : 'This agreement applies'} to {studentsNeedingAcceptance!.length === 1 ? 'your child' : 'your children'} / تسري هذه الاتفاقية على الأبناء:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {studentsNeedingAcceptance!.map(s => (
                      <li key={s.id} className="text-sm text-blue-700 dark:text-blue-300">
                        • {s.first_name} {s.last_name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Accepting will grant {studentsNeedingAcceptance!.length === 1 ? 'them' : 'all of them'} access to the student portal. / القبول سيمنحهم إمكانية الوصول لبوابة الطالب.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable agreement body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {agreements.map((item, idx) => (
              <div key={item.id}>
                {multiple && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.title || `Agreement ${idx + 1}`}
                    </h3>
                  </div>
                )}
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: item.content }}
                />
                {multiple && idx < agreements.length - 1 && (
                  <hr className="mt-6 border-gray-200 dark:border-gray-700" />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-4">
            {/* Read confirmation checkbox */}
            <label
              ref={checkboxLabelRef}
              className={`flex items-start gap-3 cursor-pointer select-none rounded-lg p-2 -m-2 transition-colors ${
                showCheckHint ? 'ring-2 ring-red-400 bg-red-50 dark:bg-red-950/30' : ''
              }`}
            >
              <Checkbox
                id="agreement-read"
                checked={read}
                onCheckedChange={v => { setRead(!!v); if (v) setShowCheckHint(false) }}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I hereby confirm that I have fully read, understood, and agreed to all the terms and conditions outlined above.
                <span className="block text-xs text-muted-foreground mt-0.5 dir-rtl text-right">
                  أؤكد بموجبه أنني قرأت وفهمت ووافقت تماماً على جميع الشروط والأحكام المبينة أعلاه.
                </span>
              </span>
            </label>
            {showCheckHint && (
              <p className="text-sm text-red-600 dark:text-red-400 -mt-2">
                Please check the box above to confirm / يرجى تحديد المربع أعلاه لتأكيد القراءة قبل المتابعة.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowRejectConfirm(true)}
                disabled={accepting || rejecting}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reject / رفض
              </Button>
              <Button
                onClick={handleAccept}
                disabled={accepting || rejecting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasStudents ? 'Accept for All Children / قبول لجميع الأبناء' : 'Accept Agreement / قبول الاتفاقية'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Reject confirmation dialog (Translated Arabic & English) */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent className="z-[10000] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <X className="h-5 w-5 text-red-500" />
                Reject Agreement? / هل ترغب في رفض الاتفاقية؟
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground pt-2">
                {/* Arabic Translation of Image */}
                <div className="dir-rtl text-right p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800 text-slate-800 dark:text-slate-200 space-y-1">
                  <p className="font-semibold text-red-700 dark:text-red-300">
                    إذا قمت برفض هذه الاتفاقية، سيتم <strong className="underline font-bold">إلغاء تفعيل حسابك فوراً</strong> وتسجيل خروجك.
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    في حال رغبت في استعادة الوصول لاحقاً، يرجى زيارة صفحة إعادة التفعيل، وإدخال بريدك الإلكتروني، وقبول الاتفاقية عند تسجيل الدخول القادم.
                  </p>
                </div>

                {/* English Text */}
                <div className="dir-ltr text-left space-y-1">
                  <p>
                    If you reject {multiple ? 'these agreements' : 'this agreement'}, your account will be{' '}
                    <strong className="text-foreground font-semibold">immediately deactivated</strong> and you will be signed out.
                  </p>
                  {hasStudents && (
                    <p className="text-amber-700 dark:text-amber-400 font-medium">
                      Your {studentsNeedingAcceptance!.length === 1 ? 'child' : 'children'} will also lose access to the student portal until you accept.
                    </p>
                  )}
                  <p className="text-xs">
                    To regain access later, visit the reactivation page, enter your email, and accept the agreement on your next login.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={rejecting} className="mt-0">
              Go Back / الرجوع
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirmed}
              disabled={rejecting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
            >
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Reject & Deactivate / نعم، رفض وإلغاء التفعيل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
