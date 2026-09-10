"use client"

// In-memory log of every attempt made during this sitting, across every tab
// (course, multiplication, division, anzan, dictation, ...). Feeds
// SessionReport's stats/coaching and useProgress's end-of-session save.
// Deliberately NOT persisted here — useProgress is the persisted layer.

import { useCallback, useState } from "react"

export type MentalMathMode =
  | "course"
  | "mult"
  | "div"
  | "exam"
  | "anzanExam"
  | "hunt"
  | "comp"
  | "anzan"
  | "dict"
  | "slips"
  | "form"
  | "read"

export interface SessionEntry {
  mode: MentalMathMode
  ok: boolean
  ms: number | null
  detail: string
  err: string | null
  skills?: string[]
  at: number
}

export function useSessionLog() {
  const [log, setLog] = useState<SessionEntry[]>([])

  const add = useCallback((entry: Omit<SessionEntry, "at">) => {
    setLog((prev) => [...prev, { ...entry, at: Date.now() }])
  }, [])

  const clear = useCallback(() => setLog([]), [])

  return { log, add, clear }
}
