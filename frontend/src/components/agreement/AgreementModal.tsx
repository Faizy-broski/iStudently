'use client'

import { useState, useRef } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, FileText, X, Users, Globe } from 'lucide-react'
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
  const systemLocale = useLocale()
  const [displayLang, setDisplayLang] = useState<'en' | 'ar'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('NEXT_LOCALE')
      if (saved === 'ar' || saved === 'en') return saved
    }
    return systemLocale.startsWith('ar') ? 'ar' : 'en'
  })

  const [read, setRead]                       = useState(false)
  const [accepting, setAccepting]             = useState(false)
  const [rejecting, setRejecting]             = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [showCheckHint, setShowCheckHint]     = useState(false)
  const checkboxLabelRef = useRef<HTMLLabelElement>(null)

  const isEn = displayLang === 'en'

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

  const firstItemTitle = isEn
    ? (agreements[0]?.title_en || agreements[0]?.title)
    : (agreements[0]?.title || agreements[0]?.title_en)

  const headerTitle = multiple
    ? (isEn ? `Review Agreements (${agreements.length})` : `مراجعة الاتفاقيات (${agreements.length})`)
    : (firstItemTitle || (isEn ? 'School Agreement' : 'اتفاقية المدرسة'))

  return (
    <>
      {/* Full-screen overlay — intentionally not dismissible */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" dir={isEn ? 'ltr' : 'rtl'}>

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{headerTitle}</h2>
                <p className="text-xs text-muted-foreground">
                  {isEn
                    ? (multiple ? 'Please read all agreements carefully before proceeding' : 'Please read the agreement before proceeding')
                    : (multiple ? 'يرجى قراءة جميع الاتفاقيات بعناية قبل المتابعة' : 'يرجى قراءة الاتفاقية بعناية قبل المتابعة')}
                </p>
              </div>
            </div>

            {/* Language Switcher Pill */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 text-xs font-medium border border-gray-200 dark:border-gray-700 shrink-0">
              <Globe className="h-3.5 w-3.5 text-gray-400 mx-1 shrink-0" />
              <button
                type="button"
                onClick={() => setDisplayLang('en')}
                className={`px-2 py-0.5 rounded transition-all ${
                  isEn
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setDisplayLang('ar')}
                className={`px-2 py-0.5 rounded transition-all ${
                  !isEn
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                عربي
              </button>
            </div>
          </div>

          {/* Linked students notice (parent only) */}
          {hasStudents && (
            <div className="mx-6 mt-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg shrink-0">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {isEn
                      ? `${multiple ? 'These agreements apply' : 'This agreement applies'} to ${studentsNeedingAcceptance!.length === 1 ? 'your child' : 'your children'}:`
                      : `تسري هذه الاتفاقية على الأبناء:`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {studentsNeedingAcceptance!.map(s => (
                      <li key={s.id} className="text-sm text-blue-700 dark:text-blue-300">
                        • {s.first_name} {s.last_name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {isEn
                      ? `Accepting will grant ${studentsNeedingAcceptance!.length === 1 ? 'them' : 'all of them'} access to the student portal.`
                      : `القبول سيمنحهم إمكانية الوصول لبوابة الطالب.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable agreement body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {agreements.map((item, idx) => {
              const itemTitle = isEn ? (item.title_en || item.title) : (item.title || item.title_en)
              const itemContent = isEn ? (item.content_en || item.content) : (item.content || item.content_en || '')

              return (
                <div key={item.id}>
                  {multiple && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {itemTitle || `${isEn ? 'Agreement' : 'اتفاقية'} ${idx + 1}`}
                      </h3>
                    </div>
                  )}
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-800 dark:text-gray-200"
                    dangerouslySetInnerHTML={{ __html: itemContent }}
                  />
                  {multiple && idx < agreements.length - 1 && (
                    <hr className="mt-6 border-gray-200 dark:border-gray-700" />
                  )}
                </div>
              )
            })}
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
                {isEn ? (
                  <>
                    I hereby confirm that I have fully read, understood, and agreed to all the terms and conditions outlined above.
                  </>
                ) : (
                  <>
                    أؤكد بموجبه أنني قرأت وفهمت ووافقت تماماً على جميع الشروط والأحكام المبينة أعلاه.
                  </>
                )}
              </span>
            </label>
            {showCheckHint && (
              <p className="text-sm text-red-600 dark:text-red-400 -mt-2">
                {isEn ? 'Please check the box above to confirm before proceeding.' : 'يرجى تحديد المربع أعلاه لتأكيد القراءة قبل المتابعة.'}
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
                {isEn ? 'Reject' : 'رفض'}
              </Button>
              <Button
                onClick={handleAccept}
                disabled={accepting || rejecting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEn
                  ? (hasStudents ? 'Accept for All Children' : 'Accept Agreement')
                  : (hasStudents ? 'قبول لجميع الأبناء' : 'قبول الاتفاقية')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Reject confirmation dialog (Translated Arabic & English) */}
      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent className="z-[10000] max-w-lg" dir={isEn ? 'ltr' : 'rtl'}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <X className="h-5 w-5 text-red-500" />
                {isEn ? 'Reject Agreement?' : 'هل ترغب في رفض الاتفاقية؟'}
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground pt-2">
                {isEn ? (
                  <div className="text-left space-y-2 p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800 text-slate-800 dark:text-slate-200">
                    <p className="font-semibold text-red-700 dark:text-red-300">
                      If you reject {multiple ? 'these agreements' : 'this agreement'}, your account will be <strong className="underline font-bold">immediately deactivated</strong> and you will be signed out.
                    </p>
                    {hasStudents && (
                      <p className="text-amber-700 dark:text-amber-400 font-medium">
                        Your {studentsNeedingAcceptance!.length === 1 ? 'child' : 'children'} will also lose access to the student portal until you accept.
                      </p>
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      To regain access later, visit the reactivation page, enter your email, and accept the agreement on your next login.
                    </p>
                  </div>
                ) : (
                  <div className="text-right p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800 text-slate-800 dark:text-slate-200 space-y-1">
                    <p className="font-semibold text-red-700 dark:text-red-300">
                      إذا قمت برفض هذه الاتفاقية، سيتم <strong className="underline font-bold">إلغاء تفعيل حسابك فوراً</strong> وتسجيل خروجك.
                    </p>
                    {hasStudents && (
                      <p className="text-amber-700 dark:text-amber-400 font-medium text-xs">
                        سيفقد {studentsNeedingAcceptance!.length === 1 ? 'ابنك' : 'جميع أبنائك'} الوصول لبوابة الطالب حتى تقوم بالقبول.
                      </p>
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      في حال رغبت في استعادة الوصول لاحقاً، يرجى زيارة صفحة إعادة التفعيل، وإدخال بريدك الإلكتروني، وقبول الاتفاقية عند تسجيل الدخول القادم.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={rejecting} className="mt-0">
              {isEn ? 'Go Back' : 'الرجوع'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirmed}
              disabled={rejecting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 text-white"
            >
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEn ? 'Yes, Reject & Deactivate' : 'نعم، رفض وإلغاء التفعيل'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

