"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTT } from "./useTT"
import { Abacus, emptyDigits, digitsToValue, valueToDigits, type Digits } from "./Abacus"
import { diagnose } from "@/lib/mentalMath/engine"
import type { useSessionLog } from "./useSessionLog"

type Mode = "form" | "read"

export function NumberFormation({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [digitCount, setDigitCount] = useState(2)
  const [mode, setMode] = useState<Mode | null>(null)
  const [digits, setDigits] = useState<Digits>(() => emptyDigits(2))
  const [target, setTarget] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [answer, setAnswer] = useState("")
  const [t0, setT0] = useState(0)
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({ text: "", tone: "idle" })

  const randNum = () => {
    const min = digitCount === 1 ? 1 : Math.pow(10, digitCount - 1)
    const max = Math.pow(10, digitCount) - 1
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  const newForm = () => {
    const n = randNum()
    setDigits(emptyDigits(digitCount)); setTarget(n); setLocked(false); setT0(performance.now())
    setMsg({ text: tt("Move the beads to match the target number.", "حرّك الخرز لتطابق العدد المطلوب."), tone: "idle" })
  }
  const newRead = () => {
    const n = randNum()
    setDigits(valueToDigits(n, digitCount)); setTarget(n); setAnswer(""); setT0(performance.now())
    setMsg({ text: tt("Read the abacus and type its value.", "اقرأ المعداد واكتب قيمته."), tone: "idle" })
  }

  const onFormChange = (next: Digits) => {
    setDigits(next)
    if (mode !== "form" || locked || target === null) return
    if (digitsToValue(next) === target) {
      setLocked(true)
      const ms = performance.now() - t0
      session.add({ mode: "form", ok: true, ms, detail: String(target), err: null })
      setMsg({ text: tt(`Well done! ${(ms / 1000).toFixed(1)}s.`, `أحسنت! ${(ms / 1000).toFixed(1)} ث.`), tone: "win" })
      setTimeout(newForm, 1200)
    }
  }
  const checkRead = () => {
    if (target === null) return
    const v = parseInt(answer, 10)
    const ok = v === target
    const ms = performance.now() - t0
    session.add({ mode: "read", ok, ms, detail: String(target), err: ok ? null : "قراءة" })
    if (ok) { setMsg({ text: tt(`Correct! ${target}.`, `صحيح! ${target}.`), tone: "win" }); setTimeout(newRead, 1200) }
    else setMsg({ text: diagnose({ n: digitCount, decimals: 0 }, target, isNaN(v) ? 0 : v), tone: "err" })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{tt("Number size", "حجم العدد")}</span>
        <Select value={String(digitCount)} onValueChange={(v) => setDigitCount(+v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => { setMode("form"); newForm() }}>{tt("Form a number", "كوّن عددًا")}</Button>
        <Button variant="outline" onClick={() => { setMode("read"); newRead() }}>{tt("Read the abacus", "اقرأ المعداد")}</Button>
      </div>

      {mode === "form" && target !== null && (
        <div className="flex items-center gap-2 text-lg">
          {tt("Form this number:", "كوّن هذا العدد:")} <span className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{target}</span>
          <Button size="sm" variant="outline" onClick={newForm}>{tt("Another number", "عدد آخر")}</Button>
        </div>
      )}
      {mode === "read" && (
        <div className="flex items-center gap-2">
          <Input type="text" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={tt("Value", "القيمة")} className="w-40" autoFocus />
          <Button onClick={checkRead} disabled={!answer}>{tt("Check", "تحقق")}</Button>
          <Button size="sm" variant="outline" onClick={newRead}>{tt("Another number", "عدد آخر")}</Button>
        </div>
      )}

      {mode && <Abacus digits={digits} onChange={mode === "form" ? onFormChange : undefined} readOnly={mode === "read"} />}

      {msg.text && <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : msg.tone === "err" ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>{msg.text}</p>}
    </div>
  )
}
