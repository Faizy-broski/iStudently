"use client"

// The original freeform (non-curriculum) signed-terms flash drill, ported to
// the shared digit-array Abacus format. Kept alongside the new leveled
// "Course" tab as a quick, level-agnostic option.

import { useEffect, useState } from "react"
import { Play, RotateCcw, Square, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Abacus, emptyDigits, type Digits } from "./Abacus"
import { useTT } from "./useTT"
import type { useSessionLog } from "./useSessionLog"

type DrillPhase = "idle" | "showing" | "answering" | "result" | "complete"
type Pace = "slow" | "medium" | "fast"
interface Problem { terms: number[]; answer: number }
const PACE_MS: Record<Pace, number> = { slow: 3000, medium: 2000, fast: 1200 }

function generateProblem(termCount: number, allowSubtraction: boolean, maxTerm: number): Problem {
  const terms: number[] = []
  let running = 0
  for (let i = 0; i < termCount; i++) {
    const magnitude = Math.floor(Math.random() * maxTerm) + 1
    let sign = 1
    if (allowSubtraction && i > 0 && Math.random() < 0.5 && running - magnitude >= 0) sign = -1
    running += sign * magnitude
    terms.push(sign * magnitude)
  }
  return { terms, answer: running }
}

export function TimedDrill({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [digitsCfg, setDigitsCfg] = useState(2)
  const [termCount, setTermCount] = useState(5)
  const [allowSubtraction, setAllowSubtraction] = useState(false)
  const [pace, setPace] = useState<Pace>("medium")
  const [roundLength, setRoundLength] = useState(10)

  const [phase, setPhase] = useState<DrillPhase>("idle")
  const [problems, setProblems] = useState<Problem[]>([])
  const [problemIndex, setProblemIndex] = useState(0)
  const [termIndex, setTermIndex] = useState(0)
  const [digits, setDigits] = useState<Digits>(() => emptyDigits(2))
  const [answerInput, setAnswerInput] = useState("")
  const [results, setResults] = useState<boolean[]>([])

  const currentProblem = problems[problemIndex]

  useEffect(() => {
    if (phase !== "showing" || !currentProblem) return
    if (termIndex >= currentProblem.terms.length) { setPhase("answering"); setAnswerInput(""); return }
    const timer = setTimeout(() => setTermIndex((i) => i + 1), PACE_MS[pace])
    return () => clearTimeout(timer)
  }, [phase, termIndex, currentProblem, pace])

  const startRound = () => {
    const maxTerm = Math.pow(10, digitsCfg) - 1
    const list = Array.from({ length: roundLength }, () => generateProblem(termCount, allowSubtraction, maxTerm))
    setProblems(list); setProblemIndex(0); setTermIndex(0); setResults([])
    setDigits(emptyDigits(digitsCfg + 1))
    setPhase("showing")
  }
  const stopRound = () => setPhase("idle")

  const submitAnswer = () => {
    if (!currentProblem) return
    const correct = Number(answerInput) === currentProblem.answer
    session.add({ mode: "course", ok: correct, ms: null, detail: "تمرين موقوت", err: correct ? null : "تمرين موقوت" })
    setResults((r) => [...r, correct])
    setPhase("result")
  }
  const nextProblem = () => {
    if (problemIndex + 1 >= problems.length) { setPhase("complete"); return }
    setProblemIndex((i) => i + 1); setTermIndex(0); setDigits(emptyDigits(digitsCfg + 1)); setPhase("showing")
  }

  const currentTerm = phase === "showing" && currentProblem ? currentProblem.terms[termIndex] : null
  const lastResult = results.length > 0 ? results[results.length - 1] : null
  const correctCount = results.filter(Boolean).length

  if (phase === "idle") {
    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <Setting label={tt("Digits per number", "عدد الأرقام لكل عدد")} options={[1, 2, 3]} value={digitsCfg} onChange={setDigitsCfg} />
          <Setting label={tt("Terms per problem", "عدد الخطوات لكل مسألة")} options={[3, 4, 5, 6, 8]} value={termCount} onChange={setTermCount} />
          <div className="space-y-1">
            <span className="text-sm font-medium">{tt("Operations", "العمليات")}</span>
            <div className="flex gap-2">
              <Button size="sm" variant={!allowSubtraction ? "default" : "outline"} onClick={() => setAllowSubtraction(false)}>{tt("Addition only", "جمع فقط")}</Button>
              <Button size="sm" variant={allowSubtraction ? "default" : "outline"} onClick={() => setAllowSubtraction(true)}>{tt("Addition & subtraction", "جمع وطرح")}</Button>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">{tt("Pace", "السرعة")}</span>
            <div className="flex gap-2">
              {(["slow", "medium", "fast"] as Pace[]).map((p) => (
                <Button key={p} size="sm" variant={pace === p ? "default" : "outline"} onClick={() => setPace(p)}>
                  {tt({ slow: "Slow", medium: "Medium", fast: "Fast" }[p], { slow: "بطيء", medium: "متوسط", fast: "سريع" }[p])}
                </Button>
              ))}
            </div>
          </div>
          <Setting label={tt("Problems per round", "عدد المسائل في الجولة")} options={[5, 10, 15]} value={roundLength} onChange={setRoundLength} />
          <Button onClick={startRound} className="w-full gap-1.5 gradient-blue border-0 text-white">
            <Play className="h-4 w-4" />
            {tt("Start drill", "ابدأ التمرين")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (phase === "complete") {
    const accuracy = problems.length > 0 ? Math.round((correctCount / problems.length) * 100) : 0
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="text-lg font-semibold">{tt("Round complete", "اكتملت الجولة")}</p>
          <p className="text-3xl font-bold tabular-nums">{correctCount} / {problems.length}</p>
          <p className="text-sm text-muted-foreground">{tt(`${accuracy}% accuracy`, `دقة ${accuracy}%`)}</p>
          <Button onClick={() => setPhase("idle")} className="gap-1.5"><RotateCcw className="h-4 w-4" />{tt("New round", "جولة جديدة")}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{tt(`Problem ${problemIndex + 1} of ${problems.length}`, `المسألة ${problemIndex + 1} من ${problems.length}`)}</span>
        <Button size="sm" variant="outline" onClick={stopRound} className="gap-1.5"><Square className="h-3.5 w-3.5" />{tt("Stop", "إيقاف")}</Button>
      </div>

      <div className="flex h-24 items-center justify-center rounded-lg border bg-muted/40">
        {phase === "showing" && currentTerm !== null && (
          <span className={cn("text-5xl font-bold tabular-nums", currentTerm >= 0 ? "text-green-600" : "text-red-600")}>
            {currentTerm >= 0 ? "+" : "−"} {Math.abs(currentTerm)}
          </span>
        )}
        {phase === "answering" && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Timer className="h-4 w-4" />{tt("What's the total?", "ما هو الناتج؟")}</span>}
        {phase === "result" && currentProblem && (
          <div className="text-center">
            <p className={cn("text-2xl font-bold", lastResult ? "text-green-600" : "text-red-600")}>{lastResult ? tt("Correct!", "صحيح!") : tt("Not quite", "غير صحيح")}</p>
            <p className="text-sm text-muted-foreground">{tt(`Correct answer: ${currentProblem.answer}`, `الإجابة الصحيحة: ${currentProblem.answer}`)}</p>
          </div>
        )}
      </div>

      <Abacus digits={digits} onChange={setDigits} />

      {phase === "answering" && (
        <div className="flex items-center gap-2">
          <Input type="number" value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} placeholder={tt("Your answer", "إجابتك")} className="w-40" autoFocus />
          <Button onClick={submitAnswer} disabled={answerInput === ""}>{tt("Submit", "إرسال")}</Button>
        </div>
      )}
      {phase === "result" && (
        <Button onClick={nextProblem} className="gradient-blue border-0 text-white">{problemIndex + 1 >= problems.length ? tt("Finish", "إنهاء") : tt("Next problem", "المسألة التالية")}</Button>
      )}
    </div>
  )
}

function Setting({ label, options, value, onChange }: { label: string; options: number[]; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((n) => (
          <Button key={n} size="sm" variant={value === n ? "default" : "outline"} onClick={() => onChange(n)}>{n}</Button>
        ))}
      </div>
    </div>
  )
}
