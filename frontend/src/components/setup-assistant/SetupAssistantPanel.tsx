'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import {
  getSetupAssistantProgress,
  completeSetupStep,
  dismissSetupAssistant,
} from '@/lib/api/setup-assistant'
import { getSetupSteps, getAllStepIds } from '@/config/setup-steps'
import type { SetupStepCategory } from '@/config/setup-steps'

export function SetupAssistantPanel() {
  const { profile } = useAuth()
  const { isPluginActive, settings } = useSchoolSettings()

  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const role = profile?.role ?? ''
  const categories: SetupStepCategory[] = getSetupSteps(role)
  const allStepIds = getAllStepIds(role)
  const totalSteps = allStepIds.length
  const completedCount = allStepIds.filter((id) => completedSteps.has(id)).length
  const allDone = completedCount === totalSteps && totalSteps > 0

  // Check if this role is enabled for the assistant
  const isRoleEnabled = settings?.setup_assistant_config?.[role] ?? false

  // Fetch progress on mount
  useEffect(() => {
    if (!profile || !isPluginActive('setup_assistant') || !isRoleEnabled) {
      setLoading(false)
      return
    }

    let cancelled = false
    getSetupAssistantProgress().then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setCompletedSteps(new Set(res.data.completed_steps))
        setDismissed(res.data.dismissed)
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [profile, isPluginActive, isRoleEnabled])

  const handleToggleStep = useCallback(async (stepId: string) => {
    if (completedSteps.has(stepId)) return // steps can only be completed, not un-completed

    // Optimistic update
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      next.add(stepId)
      return next
    })

    // Fire-and-forget to backend
    completeSetupStep(stepId).catch(() => {
      // Revert on error
      setCompletedSteps((prev) => {
        const next = new Set(prev)
        next.delete(stepId)
        return next
      })
    })
  }, [completedSteps])

  const handleDismiss = useCallback(async () => {
    setDismissing(true)
    const res = await dismissSetupAssistant()
    if (res.success) {
      setDismissed(true)
    }
    setDismissing(false)
  }, [])

  // Don't render if: plugin inactive, role not enabled, dismissed, loading, or no steps
  if (!isPluginActive('setup_assistant') || !isRoleEnabled || dismissed || loading || totalSteps === 0) {
    return null
  }

  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0

  return (
    <Card className="border-[#022172]/20 bg-gradient-to-r from-[#022172]/5 to-white overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#022172]/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#022172] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Setup Assistant</h3>
              <p className="text-xs text-gray-500">
                {allDone
                  ? 'All steps complete! You can dismiss this assistant.'
                  : `${completedCount} of ${totalSteps} steps complete`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-32 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#022172] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#022172]">{progressPercent}%</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
              onClick={handleDismiss}
              disabled={dismissing}
              title="Dismiss assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Step Categories */}
        {!collapsed && (
          <div className="px-5 py-4 space-y-5">
            {categories.map((category) => {
              const catCompleted = category.steps.filter((s) => completedSteps.has(s.id)).length
              const catTotal = category.steps.length
              const catDone = catCompleted === catTotal

              return (
                <div key={category.title}>
                  {/* Category Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <category.icon className={`h-4 w-4 ${catDone ? 'text-green-500' : 'text-[#022172]'}`} />
                    <span className="text-sm font-semibold text-gray-800">{category.title}</span>
                    <span className="text-xs text-gray-400">
                      {catCompleted}/{catTotal}
                    </span>
                  </div>

                  {/* Steps */}
                  <ol className="space-y-1 ml-6">
                    {category.steps.map((step, idx) => {
                      const isComplete = completedSteps.has(step.id)
                      return (
                        <li key={step.id} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4 text-right">{idx + 1}.</span>
                          <button
                            type="button"
                            onClick={() => handleToggleStep(step.id)}
                            className={`shrink-0 transition-colors ${
                              isComplete
                                ? 'text-green-500'
                                : 'text-gray-300 hover:text-[#022172]'
                            }`}
                            disabled={isComplete}
                            title={isComplete ? 'Completed' : 'Mark as complete'}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </button>
                          <Link
                            href={step.href}
                            className={`text-sm transition-colors ${
                              isComplete
                                ? 'text-gray-400 line-through'
                                : 'text-[#022172] hover:underline'
                            }`}
                          >
                            {step.text}
                          </Link>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )
            })}

            {/* Done button (visible when all steps complete) */}
            {allDone && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleDismiss}
                  disabled={dismissing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {dismissing ? 'Dismissing…' : 'Done — Hide Assistant'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
