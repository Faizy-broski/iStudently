"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Abacus, emptyDigits, digitsToValue, type Digits } from "./Abacus"
import { useTT } from "./useTT"
import { multPairs } from "@/lib/mentalMath/engine"
import type { useSessionLog } from "./useSessionLog"

type Shape = "2x1" | "3x1" | "2x2" | "3x2"
const SHAPES: { value: Shape; en: string; ar: string }[] = [
  { value: "2x1", en: "Two digits × one digit", ar: "منزلتان × منزلة" },
  { value: "3x1", en: "Three digits × one digit", ar: "ثلاث منازل × منزلة" },
  { value: "2x2", en: "Two digits × two digits", ar: "منزلتان × منزلتان" },
  { value: "3x2", en: "Three digits × two digits", ar: "ثلاث منازل × منزلتان" },
]

function randDigits(n: number) {
  const min = Math.pow(10, n - 1)
  const max = Math.pow(10, n) - 1
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function Multiplication({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [shape, setShape] = useState<Shape>("2x1")
  const [problem, setProblem] = useState<{ a: number; b: number; product: number; t0: number; done: boolean } | null>(null)
  const [digits, setDigits] = useState<Digits>(() => emptyDigits(6))
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({ text: tt("Press \"New problem\".", "اضغط «مسألة جديدة»."), tone: "idle" })

  const newProblem = () => {
    const [ad, bd] = shape.split("x").map(Number)
    const a = randDigits(ad)
    const b = randDigits(bd)
    const rods = Math.max(8, String(a * b).length + 1)
    setDigits(emptyDigits(rods))
    setProblem({ a, b, product: a * b, t0: performance.now(), done: false })
    setMsg({ text: tt("Compute the product on the abacus.", "احسب الناتج على المعداد."), tone: "idle" })
  }

  const onAbacusChange = (next: Digits) => {
    setDigits(next)
    if (!problem || problem.done) return
    if (digitsToValue(next) === problem.product) {
      const ms = performance.now() - problem.t0
      session.add({ mode: "mult", ok: true, ms, detail: `${problem.a}×${problem.b}=${problem.product}`, err: null })
      setProblem({ ...problem, done: true })
      setMsg({ text: tt(`Correct — ${problem.a} × ${problem.b} = ${problem.product} in ${(ms / 1000).toFixed(1)}s.`, `صحيح — ${problem.a} × ${problem.b} = ${problem.product} في ${(ms / 1000).toFixed(1)} ث.`), tone: "win" })
    }
  }

  const explain = () => {
    if (!problem) {
      setMsg({ text: tt("Start a problem first.", "ابدأ مسألة أولاً."), tone: "idle" })
      return
    }
    const steps = multPairs(problem.a, problem.b).map((s, i) => `${i + 1}) ${s.a}×${s.b}=${s.p} → add so its ones land in place ${s.place + 1} from the right.`)
    setMsg({ text: tt("Order: ", "الترتيب: ") + steps.join(" "), tone: "idle" })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={shape} onValueChange={(v) => setShape(v as Shape)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SHAPES.map((s) => <SelectItem key={s.value} value={s.value}>{tt(s.en, s.ar)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={newProblem}>{tt("New problem", "مسألة ضرب")}</Button>
        <Button variant="outline" onClick={explain}>{tt("Explain order", "اشرح الترتيب")}</Button>
      </div>

      {problem && (
        <div className="text-2xl font-bold tabular-nums" dir="ltr">{problem.a} × {problem.b} = ؟</div>
      )}

      <Abacus digits={digits} onChange={onAbacusChange} />

      <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : msg.tone === "err" ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>
        {msg.text}
      </p>

      <div className="rounded-lg border-s-4 border-blue-500 bg-muted/40 p-3 text-sm">
        {tt("Coach tip: multiply digit by digit — pin down which digit you're multiplying with (a finger or your eyes), so you never lose your place or multiply the same pair twice.", "نصيحة المدرب: اضرب رقمًا برقم — ثبّت الرقم الذي تضرب به (بإصبعك أو نظرك) حتى لا تُضيع مكانك أو تضرب نفس الزوج مرتين.")}
      </div>
    </div>
  )
}
