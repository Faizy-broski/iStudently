"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTT } from "./useTT"
import type { useSessionLog } from "./useSessionLog"

type Kind = "5" | "10" | "mix"

export function Complements({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [kind, setKind] = useState<Kind>("10")
  const [running, setRunning] = useState(false)
  const [q, setQ] = useState<{ base: number; x: number; ans: number } | null>(null)
  const [score, setScore] = useState(0)
  const [miss, setMiss] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [msg, setMsg] = useState("")
  const t0Ref = useRef(0)
  const endRef = useRef(0)

  const nextQ = () => {
    const base = kind === "mix" ? (Math.random() < 0.5 ? 5 : 10) : Number(kind)
    const x = base === 5 ? 1 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 9)
    setQ({ base, x, ans: base - x })
    t0Ref.current = performance.now()
  }

  const start = () => {
    setRunning(true); setScore(0); setMiss(0); setSecondsLeft(30); setMsg("")
    endRef.current = performance.now() + 30000
    nextQ()
  }

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const left = Math.max(0, (endRef.current - performance.now()) / 1000)
      setSecondsLeft(Math.ceil(left))
      if (left <= 0) {
        clearInterval(id)
        setRunning(false)
        setMsg(score >= 20 ? tt("Excellent speed — the complements are automatic for you.", "سرعة ممتازة — صارت المكوّنات تلقائية عندك.") : score >= 12 ? tt("Good — repeat this drill until you pass 20.", "جيد — كرّر التمرين حتى تتجاوز 20.") : tt("Start by memorizing the pairs: 9&1, 8&2, 7&3, 6&4, 5&5.", "ابدأ بحفظ الأزواج: 9 و1، 8 و2، 7 و3، 6 و4، 5 و5."))
      }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const answer = (v: number) => {
    if (!running || !q) return
    const ok = v === q.ans
    const ms = performance.now() - t0Ref.current
    session.add({ mode: "comp", ok, ms, detail: `${q.x}+?=${q.base}`, err: ok ? null : "مكوّن" })
    if (ok) setScore((s) => s + 1)
    else setMiss((m) => m + 1)
    nextQ()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)} disabled={running}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="5">{tt("Friends of five", "أصدقاء الخمسة")}</SelectItem>
            <SelectItem value="10">{tt("Friends of ten", "أصدقاء العشرة")}</SelectItem>
            <SelectItem value="mix">{tt("Quick mix", "مزيج سريع")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={start} disabled={running}>{tt("30-second race", "سباق 30 ثانية")}</Button>
        {running && <span className="text-sm text-muted-foreground">{secondsLeft}s — {tt("correct", "صحيح")} {score} / {tt("wrong", "خطأ")} {miss}</span>}
      </div>

      <div className="flex h-28 items-center justify-center rounded-lg border bg-muted/40 text-4xl font-bold tabular-nums" dir="ltr">
        {running && q ? `${q.x} + ? = ${q.base}` : "؟"}
      </div>

      <div className="grid grid-cols-5 gap-2 max-w-md">
        {Array.from({ length: 10 }).map((_, i) => (
          <Button key={i} variant="outline" onClick={() => answer(i)} disabled={!running}>{i}</Button>
        ))}
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  )
}
