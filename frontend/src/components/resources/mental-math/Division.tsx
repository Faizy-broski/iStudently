"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTT } from "./useTT"
import { divSteps, roundTo } from "@/lib/mentalMath/engine"
import type { useSessionLog } from "./useSessionLog"

type Mode = "exact" | "rem" | "dec"
type Shape = "2x1" | "3x1" | "4x2"

function randDigits(n: number) {
  const min = Math.pow(10, n - 1)
  const max = Math.pow(10, n) - 1
  return min + Math.floor(Math.random() * (max - min + 1))
}

interface DivProblem {
  a: number
  b: number
  q: number
  rem: number
  dec: number
  mode: Mode
  t0: number
}

export function Division({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [shape, setShape] = useState<Shape>("2x1")
  const [mode, setMode] = useState<Mode>("exact")
  const [problem, setProblem] = useState<DivProblem | null>(null)
  const [qInput, setQInput] = useState("")
  const [rInput, setRInput] = useState("")
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({
    text: tt("Choose a mode and press \"New problem\".", "اختر نمطًا واضغط «مسألة جديدة»."),
    tone: "idle",
  })

  const newProblem = () => {
    const [ad, bd] = shape.split("x").map(Number)
    let a: number, b: number, q = 0, rem = 0
    if (mode === "exact") {
      let tries = 0
      do {
        b = randDigits(bd)
        q = randDigits(Math.max(1, ad - bd))
        a = b * q
        tries++
      } while ((String(a).length !== ad) && tries < 300)
    } else {
      b = randDigits(bd)
      a = randDigits(ad)
      q = Math.floor(a / b)
      rem = a % b
    }
    setProblem({ a: a!, b: b!, q, rem, dec: roundTo(a! / b!, 3), mode, t0: performance.now() })
    setQInput(""); setRInput("")
    setMsg({ text: tt("Compute on the abacus, then type your answer.", "احسب على المعداد ثم اكتب إجابتك."), tone: "idle" })
  }

  const check = () => {
    if (!problem) return
    const ms = performance.now() - problem.t0
    let ok: boolean
    let detail: string
    if (problem.mode === "dec") {
      const v = parseFloat(qInput)
      ok = Math.abs(v - problem.dec) < 1e-9
      detail = `${problem.a}÷${problem.b}≈${problem.dec}`
    } else {
      const q = parseInt(qInput, 10)
      const r = problem.mode === "rem" ? parseInt(rInput || "0", 10) : 0
      ok = q === problem.q && r === problem.rem
      detail = `${problem.a}÷${problem.b}=${problem.q} r${problem.rem}`
    }
    session.add({ mode: "div", ok, ms, detail, err: null })
    if (ok) setMsg({ text: tt(`Correct — quotient ${problem.q}${problem.mode === "rem" ? `, remainder ${problem.rem}` : ""}${problem.mode === "dec" ? `≈${problem.dec}` : ""}.`, `صحيح — الخارج ${problem.q}${problem.mode === "rem" ? `، الباقي ${problem.rem}` : ""}${problem.mode === "dec" ? `≈${problem.dec}` : ""}.`), tone: "win" })
    else setMsg({ text: tt(`The correct answer is ${problem.mode === "dec" ? problem.dec : `${problem.q}${problem.mode === "rem" ? ` remainder ${problem.rem}` : ""}`}. The remainder must always be smaller than the divisor.`, `الإجابة الصحيحة ${problem.mode === "dec" ? problem.dec : `${problem.q}${problem.mode === "rem" ? ` والباقي ${problem.rem}` : ""}`}. يجب أن يكون الباقي دائمًا أصغر من المقسوم عليه.`), tone: "err" })
  }

  const explain = () => {
    if (!problem) { setMsg({ text: tt("Start a problem first.", "ابدأ مسألة أولاً."), tone: "idle" }); return }
    const steps = divSteps(problem.a, problem.b).map((o, i) => `${i + 1}) ${o.cur}÷${problem.b}=${o.qd} → place ${o.qd} in the quotient, subtract ${o.sub}${o.rem ? `, remainder ${o.rem}` : ""}.`)
    setMsg({ text: tt("Steps: ", "الخطوات: ") + steps.join(" "), tone: "idle" })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={shape} onValueChange={(v) => setShape(v as Shape)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2x1">{tt("Two digits ÷ one digit", "منزلتان ÷ منزلة")}</SelectItem>
            <SelectItem value="3x1">{tt("Three digits ÷ one digit", "ثلاث منازل ÷ منزلة")}</SelectItem>
            <SelectItem value="4x2">{tt("Four digits ÷ two digits", "أربع منازل ÷ منزلتان")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="exact">{tt("No remainder", "بلا باقٍ")}</SelectItem>
            <SelectItem value="rem">{tt("With remainder", "بباقٍ")}</SelectItem>
            <SelectItem value="dec">{tt("Rounded decimal (3 places)", "كسر عشري (3 منازل)")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={newProblem}>{tt("New problem", "مسألة قسمة")}</Button>
        <Button variant="outline" onClick={explain}>{tt("Explain steps", "اشرح الخطوات")}</Button>
      </div>

      {problem && <div className="text-2xl font-bold tabular-nums" dir="ltr">{problem.a} ÷ {problem.b} = ؟</div>}

      {problem && (
        <div className="flex items-center gap-2">
          <Input type="text" inputMode="decimal" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={tt("Quotient", "الخارج")} className="w-32" />
          {problem.mode === "rem" && <Input type="text" inputMode="numeric" value={rInput} onChange={(e) => setRInput(e.target.value)} placeholder={tt("Remainder", "الباقي")} className="w-28" />}
          <Button onClick={check} disabled={!qInput}>{tt("Check", "تحقق")}</Button>
        </div>
      )}

      <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : msg.tone === "err" ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>
        {msg.text}
      </p>
    </div>
  )
}
