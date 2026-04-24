'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  Map,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { getTourSteps, type TourStep } from '@/config/tour-steps'
import { dismissSetupAssistant } from '@/lib/api/setup-assistant'

// ─── Local Storage ────────────────────────────────────────────────────────────

const TOUR_KEY = 'studently_tour_v1'

interface TourState {
  active: boolean
  stepIndex: number
  role: string
  dismissed: boolean
}

function getStoredState(role: string): TourState {
  try {
    const raw = localStorage.getItem(TOUR_KEY)
    if (raw) {
      const parsed: TourState = JSON.parse(raw)
      if (parsed.role === role) return parsed
    }
  } catch {
    // ignore
  }
  return { active: false, stepIndex: 0, role, dismissed: false }
}

function saveState(state: TourState) {
  try {
    localStorage.setItem(TOUR_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

// ─── Welcome Card ─────────────────────────────────────────────────────────────

function WelcomeCard({
  totalSteps,
  onStart,
  onSkip,
}: {
  totalSteps: number
  onStart: () => void
  onSkip: () => void
}) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-[360px] animate-in slide-in-from-bottom-4 fade-in duration-500"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Card */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#022172] via-[#033399] to-[#011550]" />

        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-[#EEA831]/10 pointer-events-none" />

        <div className="relative z-10 p-6">
          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-[#EEA831] flex items-center justify-center shadow-lg shrink-0">
              <Compass className="h-6 w-6 text-[#022172]" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">
                Take the App Tour
              </h3>
              <p className="text-white/60 text-xs mt-0.5">
                {totalSteps} stops across all modules
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-white/75 text-sm leading-relaxed mb-5">
            Let us walk you through every section of the system — from School
            Setup to Grades, Attendance, and beyond. Takes just a few minutes.
          </p>

          {/* Step dots preview */}
          <div className="flex items-center gap-1 mb-5 overflow-hidden">
            {Array.from({ length: Math.min(totalSteps, 12) }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full bg-white/20 flex-1"
                style={{ maxWidth: 24 }}
              />
            ))}
            {totalSteps > 12 && (
              <span className="text-white/40 text-xs ml-1">+{totalSteps - 12}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#EEA831] hover:bg-[#d4931d] text-[#022172] font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:shadow-[#EEA831]/30 active:scale-95"
            >
              <Map className="h-4 w-4" />
              Start Tour
            </button>
            <button
              onClick={onSkip}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors duration-200"
              title="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tour Popup ───────────────────────────────────────────────────────────────

function TourPopup({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrevious,
  onCancel,
}: {
  step: TourStep
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onPrevious: () => void
  onCancel: () => void
}) {
  const Icon = step.categoryIcon
  const progress = ((stepIndex + 1) / totalSteps) * 100
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-[380px] animate-in slide-in-from-bottom-3 fade-in duration-400"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#022172]/20 bg-white">
        {/* Top accent bar */}
        <div className="h-1 bg-gray-100 w-full">
          <div
            className="h-full bg-gradient-to-r from-[#022172] to-[#EEA831] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-[#022172] to-[#033399] px-5 pt-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Category icon badge */}
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0 ring-1 ring-white/20">
                <Icon className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-[#EEA831] text-[10px] font-semibold uppercase tracking-widest leading-none mb-1">
                  {step.category}
                </p>
                <h4 className="text-white font-bold text-sm leading-tight">
                  {step.title}
                </h4>
              </div>
            </div>

            {/* Step counter + cancel */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2.5 py-1">
                <Sparkles className="h-3 w-3 text-[#EEA831]" />
                <span className="text-white text-xs font-semibold tabular-nums">
                  {stepIndex + 1}
                  <span className="text-white/50">/{totalSteps}</span>
                </span>
              </div>
              <button
                onClick={onCancel}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-500/30 flex items-center justify-center text-white/50 hover:text-white transition-all duration-200"
                title="Cancel tour"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Description body */}
        <div className="px-5 py-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Step mini-dots */}
        <div className="px-5 pb-4 flex items-center gap-1 overflow-hidden">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? 'w-6 bg-[#022172]'
                  : i < stepIndex
                  ? 'flex-1 bg-[#022172]/30'
                  : 'flex-1 bg-gray-200'
              }`}
              style={{ minWidth: i === stepIndex ? 24 : undefined }}
            />
          ))}
        </div>

        {/* Navigation footer */}
        <div className="px-5 pb-5 flex items-center gap-2">
          {/* Previous */}
          <button
            onClick={onPrevious}
            disabled={isFirst}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isFirst
                ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                : 'text-[#022172] bg-[#022172]/8 hover:bg-[#022172]/15 active:scale-95'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {/* Next / Finish */}
          <button
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#022172] hover:bg-[#033399] text-white font-semibold text-sm transition-all duration-200 shadow-md shadow-[#022172]/25 hover:shadow-lg hover:shadow-[#022172]/35 active:scale-95"
          >
            {isLast ? (
              <>
                <span>Finish Tour</span>
                <Sparkles className="h-4 w-4 text-[#EEA831]" />
              </>
            ) : (
              <>
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Cancel text link */}
        <div className="flex justify-center pb-3 -mt-2">
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xs transition-colors duration-200 underline-offset-2 hover:underline"
          >
            Cancel Tour
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TourAssistantPanel() {
  const { profile } = useAuth()
  const { isPluginActive, settings } = useSchoolSettings()
  const router = useRouter()

  const role = profile?.role ?? ''
  const isRoleEnabled = settings?.setup_assistant_config?.[role] ?? false

  const tourSteps = useMemo(() => getTourSteps(role), [role])
  const [tourState, setTourState] = useState<TourState | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  // ── Load state from localStorage on mount ──
  useEffect(() => {
    if (!profile || !isPluginActive('setup_assistant') || !isRoleEnabled) {
      setLoading(false)
      return
    }

    const stored = getStoredState(role)
    setTourState(stored)
    setLoading(false)

    // Brief delay before showing so it doesn't flash during page load
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [profile, isPluginActive, isRoleEnabled, role])

  // Keep ref updated when tourSteps changes
  const totalSteps = tourSteps.length

  // ── Handlers ──
  const handleStart = useCallback(() => {
    if (tourSteps.length === 0) return
    const newState: TourState = { active: true, stepIndex: 0, role, dismissed: false }
    setTourState(newState)
    saveState(newState)
    router.push(tourSteps[0].href)
  }, [tourSteps, role, router])

  const handleNext = useCallback(() => {
    if (!tourState) return
    const nextIndex = tourState.stepIndex + 1

    if (nextIndex >= totalSteps) {
      // Tour complete
      const newState: TourState = { active: false, stepIndex: 0, role, dismissed: true }
      setTourState(newState)
      saveState(newState)
      dismissSetupAssistant().catch(() => {})
      return
    }

    const newState: TourState = { ...tourState, stepIndex: nextIndex }
    setTourState(newState)
    saveState(newState)
    router.push(tourSteps[nextIndex].href)
  }, [tourState, totalSteps, tourSteps, role, router])

  const handlePrevious = useCallback(() => {
    if (!tourState || tourState.stepIndex === 0) return
    const prevIndex = tourState.stepIndex - 1
    const newState: TourState = { ...tourState, stepIndex: prevIndex }
    setTourState(newState)
    saveState(newState)
    router.push(tourSteps[prevIndex].href)
  }, [tourState, tourSteps, router])

  const handleCancel = useCallback(() => {
    const newState: TourState = { active: false, stepIndex: 0, role, dismissed: true }
    setTourState(newState)
    saveState(newState)
    dismissSetupAssistant().catch(() => {})
  }, [role])

  const handleSkipWelcome = useCallback(() => {
    const newState: TourState = { active: false, stepIndex: 0, role, dismissed: true }
    setTourState(newState)
    saveState(newState)
  }, [role])

  // ── Guards ──
  if (
    !isPluginActive('setup_assistant') ||
    !isRoleEnabled ||
    loading ||
    !visible ||
    totalSteps === 0 ||
    !tourState
  ) {
    return null
  }

  // Dismissed — show nothing
  if (tourState.dismissed) return null

  // Tour not yet started — show welcome card
  if (!tourState.active) {
    return (
      <WelcomeCard
        totalSteps={totalSteps}
        onStart={handleStart}
        onSkip={handleSkipWelcome}
      />
    )
  }

  // Tour active — show step popup
  const currentStep = tourSteps[tourState.stepIndex]
  if (!currentStep) return null

  return (
    <TourPopup
      step={currentStep}
      stepIndex={tourState.stepIndex}
      totalSteps={totalSteps}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onCancel={handleCancel}
    />
  )
}
