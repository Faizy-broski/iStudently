'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { getPaymentReminderStatus, PaymentReminderStatus } from '@/lib/api/school-settings'
import { useCampus } from '@/context/CampusContext'
import { useAuth } from '@/context/AuthContext'

export function PaymentReminderToast() {
  const { user, profile, loading: authLoading } = useAuth()
  // useCampus() returns undefined when rendered outside a CampusProvider —
  // not guaranteed for every role's layout (e.g. parent/student). Fall back
  // to profile.campus_id (already populated in AuthContext independent of
  // CampusContext) so this still works correctly without one.
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id ?? profile?.campus_id ?? null

  const [status, setStatus] = useState<PaymentReminderStatus | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const [secondsLeft, setSecondsLeft] = useState(5)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }, [])

  useEffect(() => {
    // Only run check for authenticated parents or students
    if (authLoading || !user || !profile) return
    const role = (profile.role || '').toLowerCase()
    if (role !== 'parent' && role !== 'student') return

    let isMounted = true

    getPaymentReminderStatus(campusId)
      .then((res) => {
        if (!isMounted) return
        if (res.success && res.data) {
          const data = res.data
          setStatus(data)
          if (data.enable_payment_reminder && data.has_overdue_balance) {
            setIsVisible(true)
            const durationSec = data.auto_dismiss_seconds || 5
            setSecondsLeft(durationSec)
            setProgress(100)
            startTimeRef.current = Date.now()

            // Progress bar & seconds timer loop
            const durationMs = durationSec * 1000

            const updateProgress = () => {
              if (!startTimeRef.current) return
              const elapsed = Date.now() - startTimeRef.current
              const remainingMs = Math.max(0, durationMs - elapsed)
              const pct = (remainingMs / durationMs) * 100
              const sec = Math.ceil(remainingMs / 1000)

              setProgress(pct)
              setSecondsLeft(sec)

              if (remainingMs > 0) {
                animFrameRef.current = requestAnimationFrame(updateProgress)
              } else {
                handleDismiss()
              }
            }

            animFrameRef.current = requestAnimationFrame(updateProgress)
          }
        }
      })
      .catch((err) => {
        console.error('Payment reminder status check error:', err)
      })

    return () => {
      isMounted = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user, profile, authLoading, campusId, handleDismiss])

  if (!isVisible || !status) return null

  const currency = status.currency || 'LYD'
  const isLyd = currency.toUpperCase() === 'LYD'
  const englishCurrency = currency
  const arabicCurrency = isLyd ? 'دينار ليبي' : currency
  const balanceVal = typeof status.balance === 'number' ? status.balance.toLocaleString() : status.balance

  return (
    <div className="fixed top-5 right-5 z-[9999] pointer-events-none max-w-md w-[calc(100vw-2.5rem)] sm:w-full">
      <div
        className="pointer-events-auto relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500/80 shadow-2xl ring-4 ring-amber-400/20 dark:ring-amber-500/10 p-4 sm:p-5 transition-all duration-300 animate-in fade-in slide-in-from-top-4"
        role="alert"
        aria-live="polite"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-sm sm:text-base dir-rtl">
            <Lightbulb className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>تذكير لطيف:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              {secondsLeft}s
            </span>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-3.5 text-slate-700 dark:text-slate-200 text-xs sm:text-sm">
          {/* Arabic Message */}
          <p className="dir-rtl text-right font-medium leading-relaxed text-slate-800 dark:text-slate-100">
            يرجى العلم بوجود متبقي رسوم دراسية بقيمة <span className="font-bold text-amber-700 dark:text-amber-300">{balanceVal} {arabicCurrency}</span>. نأمل التكرم بالتسديد في الأوقات المحددة.
          </p>

          {/* Divider */}
          <div className="h-px bg-slate-100 dark:bg-slate-800/80 w-full" />

          {/* English Message */}
          <p className="dir-ltr text-left leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="mr-1">💡</span>
            <strong className="font-semibold text-slate-900 dark:text-white">Friendly Reminder:</strong> You have an outstanding tuition balance of <strong className="font-bold text-amber-700 dark:text-amber-300">{balanceVal} {englishCurrency}</strong>. Please proceed with the payment at your earliest convenience.
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-amber-100 dark:bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 transition-all ease-linear"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      </div>
    </div>
  )
}
