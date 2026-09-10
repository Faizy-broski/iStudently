"use client"

// Soroban abacus — presentational, controlled. Digit representation matches
// engine.ts exactly: one 0-9 digit per rod, most-significant rod first. This
// is a deliberate change from the original inline Abacus in MentalMath.tsx
// (which used a { heaven, earth } object per rod) so every tab can hand a
// digit array straight to engine.ts's planFor/genProblem/etc. with zero
// conversion glue.

import type { KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { placeName } from "@/lib/mentalMath/engine"

export type Digits = number[]

export function emptyDigits(n: number): Digits {
  return new Array(n).fill(0)
}

export function digitsToValue(d: Digits): number {
  return parseInt(d.join("") || "0", 10)
}

export function valueToDigits(n: number, len: number): Digits {
  return String(Math.max(0, Math.floor(n)))
    .padStart(len, "0")
    .slice(-len)
    .split("")
    .map(Number)
}

interface AbacusProps {
  digits: Digits
  decimals?: number
  onChange?: (digits: Digits) => void
  /** Shows dashed "should be active" outlines on beads that differ from this target, without moving them. */
  ghostTarget?: number | null
  /** Rings one rod, e.g. to point at where a step/error is. */
  highlightRod?: number | null
  readOnly?: boolean
  /** Error-hunt mode: renders a clickable strip under each rod instead of/alongside normal bead interaction. */
  onPickRod?: (i: number) => void
}

export function Abacus({ digits, decimals = 0, onChange, ghostTarget = null, highlightRod = null, readOnly = false, onPickRod }: AbacusProps) {
  const n = digits.length
  const unit = n - 1 - decimals
  const ghostDigits = ghostTarget != null ? valueToDigits(ghostTarget, n) : null

  const setDigit = (i: number, next: number) => {
    if (readOnly || !onChange) return
    if (next < 0 || next > 9) return
    const copy = digits.slice()
    copy[i] = next
    onChange(copy)
  }
  const toggleHeaven = (i: number) => {
    const d = digits[i]
    setDigit(i, d >= 5 ? d - 5 : d + 5)
  }
  // Clicking earth bead `clicked` (0 = closest to the beam) drags every bead
  // between it and the beam along with it — same behavior as a real abacus.
  const setEarth = (i: number, clicked: number) => {
    const d = digits[i]
    const earth = d % 5
    const heaven = d >= 5 ? 5 : 0
    const nextEarth = clicked < earth ? clicked : clicked + 1
    setDigit(i, heaven + nextEarth)
  }
  const onKeyRod = (i: number, e: KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
    e.preventDefault()
    setDigit(i, digits[i] + (e.key === "ArrowUp" ? 1 : -1))
  }

  return (
    <div className="inline-flex gap-1 overflow-x-auto rounded-lg border-4 border-amber-800 bg-amber-100 p-3 pb-7 shadow-inner dark:bg-amber-950">
      {digits.map((d, i) => {
        const earth = d % 5
        const heaven = d >= 5
        const gDigit = ghostDigits ? ghostDigits[i] : null
        const gEarth = gDigit != null ? gDigit % 5 : null
        const gHeaven = gDigit != null ? gDigit >= 5 : null
        const isUnit = i === unit
        const dotMark = (unit - i) % 3 === 0

        return (
          <div
            key={i}
            className={cn("relative flex w-10 flex-col items-center rounded", highlightRod === i && "ring-2 ring-blue-500")}
            onKeyDown={(e) => onKeyRod(i, e)}
          >
            <div className="pointer-events-none absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-amber-900/40" />
            {dotMark && <div className="pointer-events-none absolute left-1/2 top-[30px] h-1 w-1 -translate-x-1/2 rounded-full bg-amber-900/60" />}

            {/* Heaven zone — 1 bead, value 5 */}
            <div className="flex h-16 w-full flex-col items-center justify-end border-b-4 border-amber-900">
              <div className="relative">
                {gHeaven && !heaven && (
                  <div className="pointer-events-none absolute inset-0 -translate-y-2 rounded-full border-2 border-dashed border-red-400 opacity-70" />
                )}
                <button
                  type="button"
                  onClick={() => toggleHeaven(i)}
                  disabled={readOnly}
                  aria-label={`heaven bead rod ${i + 1}`}
                  className={cn(
                    "z-10 h-6 w-8 rounded-full border-2 transition-transform",
                    heaven ? "translate-y-0 border-red-800 bg-red-600" : "-translate-y-2 border-red-500 bg-red-300"
                  )}
                />
              </div>
            </div>

            {/* Earth zone — 4 beads, value 1 each */}
            <div className="flex w-full flex-col items-center gap-1 pt-1">
              {Array.from({ length: 4 }).map((_, bi) => {
                const active = bi < earth
                const gActive = gEarth != null ? bi < gEarth : null
                return (
                  <div key={bi} className={cn("relative", !active && bi === earth && "mt-3")}>
                    {gActive && !active && (
                      <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-blue-400 opacity-70" />
                    )}
                    <button
                      type="button"
                      onClick={() => setEarth(i, bi)}
                      disabled={readOnly}
                      aria-label={`earth bead ${bi} rod ${i + 1}`}
                      className={cn(
                        "z-10 h-6 w-8 rounded-full border-2 transition-all",
                        active ? "border-blue-800 bg-blue-600" : "border-blue-500 bg-blue-300"
                      )}
                    />
                  </div>
                )
              })}
            </div>

            <div
              className={cn(
                "absolute -bottom-6 -left-1 -right-1 whitespace-nowrap text-center text-[10px] text-muted-foreground",
                isUnit && "font-bold text-blue-700 dark:text-blue-400"
              )}
            >
              {placeName(n, decimals, i)}
            </div>

            {onPickRod && (
              <button
                type="button"
                onClick={() => onPickRod(i)}
                aria-label={`select rod ${i + 1}`}
                className="absolute -bottom-6 -left-1 -right-1 top-0 z-20 rounded border border-dashed border-blue-400/0 bg-blue-400/0 hover:border-blue-400 hover:bg-blue-400/15"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
