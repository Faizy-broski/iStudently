"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTT } from "./useTT"
import { Abacus, emptyDigits, type Digits } from "./Abacus"
import { planFor, type Step } from "@/lib/mentalMath/engine"

export function StepExplainer() {
  const tt = useTT()
  const [op, setOp] = useState<"+" | "-">("+")
  const [operand, setOperand] = useState("")
  const [digits, setDigits] = useState<Digits>(() => emptyDigits(9))
  const [steps, setSteps] = useState<Step[]>([])
  const [idx, setIdx] = useState(0)
  const [highlightRod, setHighlightRod] = useState<number | null>(null)
  const [msg, setMsg] = useState(tt("Type a number that already appears on the abacus, and I'll explain the bead moves — step by step.", "اكتب عددًا يُضاف إلى ما هو موجود على المعداد، وسأشرح حركات الخرز خطوة بخطوة."))

  const plan = () => {
    const raw = operand.trim()
    if (!/^\d+$/.test(raw)) { setMsg(tt("Type a whole number.", "اكتب عددًا صحيحًا.")); return }
    const r = planFor({ n: digits.length, decimals: 0 }, digits, op, raw)
    if (!r.ok) { setMsg(r.steps.find((s) => s.rod === -1)?.text || tt("Can't perform this operation.", "لا يمكن تنفيذ هذه العملية.")); setSteps([]); return }
    setSteps(r.steps); setIdx(0)
    setMsg(tt(`${r.steps.length} step(s) ready. Press "Next step".`, `${r.steps.length} خطوة جاهزة. اضغط «الخطوة التالية».`))
  }
  const doStep = () => {
    if (idx >= steps.length) return
    const s = steps[idx]
    if (s.snap) setDigits(s.snap)
    setHighlightRod(s.rod)
    setMsg(tt(`Step ${idx + 1} of ${steps.length}: `, `الخطوة ${idx + 1} من ${steps.length}: `) + s.text)
    setIdx((i) => i + 1)
  }
  const runAll = () => {
    let i = idx
    const run = () => {
      if (i >= steps.length) return
      const s = steps[i]
      if (s.snap) setDigits(s.snap)
      setHighlightRod(s.rod)
      setMsg(tt(`Step ${i + 1} of ${steps.length}: `, `الخطوة ${i + 1} من ${steps.length}: `) + s.text)
      i++
      setIdx(i)
      if (i < steps.length) setTimeout(run, 750)
    }
    run()
  }
  const reset = () => { setDigits(emptyDigits(9)); setSteps([]); setIdx(0); setHighlightRod(null); setOperand("") }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={op} onValueChange={(v) => setOp(v as "+" | "-")}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="+">{tt("Add (+)", "جمع (+)")}</SelectItem>
            <SelectItem value="-">{tt("Subtract (−)", "طرح (−)")}</SelectItem>
          </SelectContent>
        </Select>
        <Input value={operand} onChange={(e) => setOperand(e.target.value)} placeholder={tt("Number", "العدد")} className="w-32" inputMode="numeric" />
        <Button onClick={plan}>{tt("Prepare steps", "حضّر الخطوات")}</Button>
        {steps.length > 0 && idx < steps.length && <Button variant="outline" onClick={doStep}>{tt("Next step", "الخطوة التالية")}</Button>}
        {steps.length > 0 && idx < steps.length && <Button variant="outline" onClick={runAll}>{tt("Run all", "نفّذ الكل")}</Button>}
        <Button variant="ghost" onClick={reset}>{tt("Reset abacus", "صفّر المعداد")}</Button>
      </div>

      <Abacus digits={digits} onChange={setDigits} highlightRod={highlightRod} />

      <div className="rounded-lg border-s-4 border-blue-500 bg-muted/40 p-3 text-sm">{msg}</div>
    </div>
  )
}
