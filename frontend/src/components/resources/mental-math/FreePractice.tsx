"use client"

import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Abacus, emptyDigits, digitsToValue, type Digits } from "./Abacus"
import { useTT } from "./useTT"

export function FreePractice() {
  const tt = useTT()
  const [rodCount, setRodCount] = useState(5)
  const [digits, setDigits] = useState<Digits>(() => emptyDigits(5))
  const [target, setTarget] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle")
  const [ghostOn, setGhostOn] = useState(true)

  useEffect(() => {
    setDigits(emptyDigits(rodCount))
    setTarget(null)
    setFeedback("idle")
  }, [rodCount])

  const total = digitsToValue(digits)

  const newChallenge = () => {
    const max = Math.pow(10, rodCount) - 1
    setTarget(Math.floor(Math.random() * (max + 1)))
    setFeedback("idle")
  }
  const checkChallenge = () => {
    if (target === null) return
    setFeedback(total === target ? "correct" : "incorrect")
  }
  const clear = () => {
    setDigits(emptyDigits(rodCount))
    setFeedback("idle")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{tt("Rods:", "الأعمدة:")}</span>
        {[3, 5, 7, 9, 13].map((n) => (
          <Button key={n} size="sm" variant={rodCount === n ? "default" : "outline"} onClick={() => setRodCount(n)}>
            {n}
          </Button>
        ))}
        <div className="mx-2 h-6 w-px bg-border" />
        <Button size="sm" variant="outline" onClick={clear} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          {tt("Clear", "مسح")}
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <Switch id="ghost-toggle" checked={ghostOn} onCheckedChange={setGhostOn} />
          <Label htmlFor="ghost-toggle" className="text-sm">{tt("Guide beads", "خرز إرشادي")}</Label>
        </div>
      </div>

      <Abacus digits={digits} onChange={setDigits} ghostTarget={ghostOn ? target : null} />

      <div className="pt-4">
        <div className="text-sm text-muted-foreground">{tt("Value", "القيمة")}</div>
        <div className="text-4xl font-bold tabular-nums">{total}</div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{tt("Build this number", "كوّن هذا الرقم")}</span>
            <Button size="sm" variant="outline" onClick={newChallenge}>
              {tt("New number", "رقم جديد")}
            </Button>
          </div>
          {target !== null && (
            <>
              <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{target}</div>
              <Button size="sm" onClick={checkChallenge}>
                {tt("Check", "تحقق")}
              </Button>
              {feedback === "correct" && <p className="text-sm font-medium text-green-600">{tt("Correct! 🎉", "صحيح! 🎉")}</p>}
              {feedback === "incorrect" && (
                <p className="text-sm font-medium text-red-600">{tt("Not quite — keep adjusting the beads.", "ليس تماماً — عدّل الخرزات.")}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
