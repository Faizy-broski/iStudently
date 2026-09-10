"use client"

// Cross-session Mental Math progress — level reached, day-by-day session
// blocks, and recurring per-error-kind counts — persisted to browser
// localStorage keyed by the logged-in profile id. No backend table, no API
// route: confirmed with the user as the intended architecture (matches the
// reference app's own local-only design, adapted from its file export/import
// dance to "just always there" since we're already signed in).

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import type { SessionEntry } from "./useSessionLog"

export interface SessionBlock {
  date: string // YYYY-MM-DD
  level: number
  attempts: number
  correct: number
  errors: Record<string, number>
}

export interface Progress {
  level: number
  sessions: SessionBlock[]
}

const DEFAULT_PROGRESS: Progress = { level: 1, sessions: [] }

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function storageKey(profileId: string): string {
  return `mentalMath:progress:${profileId}`
}

export function errorTally(log: SessionEntry[]): Record<string, number> {
  const tally: Record<string, number> = {}
  log.forEach((x) => {
    if (!x.ok && x.err) tally[x.err] = (tally[x.err] || 0) + 1
  })
  return tally
}

export function useProgress() {
  const { profile } = useAuth()
  const profileId = profile?.id || "guest"
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(profileId))
      setProgress(raw ? { ...DEFAULT_PROGRESS, ...JSON.parse(raw) } : DEFAULT_PROGRESS)
    } catch {
      setProgress(DEFAULT_PROGRESS)
    }
    setLoaded(true)
  }, [profileId])

  const persist = useCallback(
    (next: Progress) => {
      setProgress(next)
      try {
        window.localStorage.setItem(storageKey(profileId), JSON.stringify(next))
      } catch {
        /* localStorage unavailable (private mode, quota) — progress just won't persist this session */
      }
    },
    [profileId]
  )

  const setLevel = useCallback(
    (level: number) => {
      persist({ ...progress, level })
    },
    [progress, persist]
  )

  /** Appends (or replaces) today's block with the current sitting's tally, called from Session Report's "save" action. */
  const saveSessionBlock = useCallback(
    (level: number, log: SessionEntry[]) => {
      const block: SessionBlock = {
        date: todayKey(),
        level,
        attempts: log.length,
        correct: log.filter((x) => x.ok).length,
        errors: errorTally(log),
      }
      const sessions = progress.sessions.filter((s) => s.date !== todayKey()).concat([block])
      persist({ level, sessions })
    },
    [progress, persist]
  )

  /** True if a past (not-today) session already showed mastery (>=6 attempts, >=90% accuracy) at this level — used to require confirmation across two sittings before auto-unlocking the next level. */
  const masteredBefore = useCallback(
    (level: number) => progress.sessions.some((s) => s.date !== todayKey() && s.level === level && s.attempts >= 6 && s.correct / s.attempts >= 0.9),
    [progress]
  )

  const streakDays = useCallback(() => {
    const days = Array.from(new Set(progress.sessions.map((s) => s.date))).sort()
    if (!days.length) return 0
    let streak = 1
    for (let i = days.length - 1; i > 0; i--) {
      const d1 = new Date(days[i]).getTime()
      const d0 = new Date(days[i - 1]).getTime()
      if ((d1 - d0) / 86400000 <= 1.5) streak++
      else break
    }
    return streak
  }, [progress])

  return { progress, loaded, setLevel, saveSessionBlock, masteredBefore, streakDays }
}
