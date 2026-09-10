"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useTT } from "./useTT"
import { Abacus, emptyDigits, valueToDigits, type Digits } from "./Abacus"
import { toWords, diagnose, type Term } from "@/lib/mentalMath/engine"
import { useMentalMathVoice } from "./useMentalMathVoice"
import type { useSessionLog } from "./useSessionLog"

function genSeq(count: number, digitCount: number, allowSub: boolean): { seq: Term[]; total: number } {
  const min = digitCount === 1 ? 1 : Math.pow(10, digitCount - 1)
  const max = Math.pow(10, digitCount) - 1
  const seq: Term[] = []
  let run = 0
  for (let i = 0; i < count; i++) {
    const v = Math.floor(Math.random() * (max - min + 1)) + min
    let sign: "+" | "-" = i > 0 && allowSub && Math.random() < 0.35 && run > v ? "-" : "+"
    if (sign === "-" && v > run) sign = "+"
    run = sign === "+" ? run + v : run - v
    seq.push({ sign, v })
  }
  return { seq, total: run }
}

export function Anzan({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const voice = useMentalMathVoice()
  const [count, setCount] = useState(5)
  const [digitCount, setDigitCount] = useState(1)
  const [speed, setSpeed] = useState(900)
  const [allowSub, setAllowSub] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  const [useVoice, setUseVoice] = useState(false)
  const [flash, setFlash] = useState("")
  const [running, setRunning] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [answer, setAnswer] = useState("")
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({ text: "", tone: "idle" })
  const [digits, setDigits] = useState<Digits>(() => emptyDigits(digitCount + 2))
  const seqRef = useRef<{ seq: Term[]; total: number } | null>(null)
  const t0Ref = useRef(0)

  const [examMode, setExamMode] = useState(false)
  const [examItems, setExamItems] = useState<{ seq: Term[]; total: number }[]>([])
  const [examI, setExamI] = useState(0)
  const [examOk, setExamOk] = useState(0)
  const [examSecondsLeft, setExamSecondsLeft] = useState(0)
  const examEndRef = useRef(0)
  const examTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runFlash = (seq: Term[], onDone: () => void) => {
    let i = 0
    let run = 0
    const rods = digitCount + 2
    if (showBoard) setDigits(emptyDigits(rods))
    const step = () => {
      if (i >= seq.length) { setFlash(""); onDone(); return }
      const t = seq[i]
      run = t.sign === "+" ? run + t.v : run - t.v
      setFlash((t.sign === "+" ? "+" : "−") + t.v)
      if (useVoice) voice.speak((t.sign === "+" ? tt("plus ", "زائد ") : tt("minus ", "ناقص ")) + toWords(t.v))
      if (showBoard) setDigits(valueToDigits(Math.max(0, run), rods))
      i++
      setTimeout(() => { setFlash(""); setTimeout(step, Math.max(90, speed * 0.22)) }, speed * 0.78)
    }
    setTimeout(step, 500)
  }

  const start = () => {
    if (running) return
    const g = genSeq(count, digitCount, allowSub)
    seqRef.current = g
    setRunning(true); setWaiting(false); setAnswer(""); setMsg({ text: "", tone: "idle" })
    setFlash(tt("Get ready…", "استعد…"))
    runFlash(g.seq, () => { setRunning(false); setWaiting(true); t0Ref.current = performance.now() })
  }

  const check = () => {
    if (!seqRef.current) return
    const v = parseInt(answer, 10)
    const ok = v === seqRef.current.total
    const ms = performance.now() - t0Ref.current
    session.add({ mode: "anzan", ok, ms, detail: seqRef.current.seq.map((t, i) => (i ? t.sign : "") + t.v).join(" ") + " = " + seqRef.current.total, err: ok ? null : "أنزان" })
    setMsg(ok
      ? { text: tt(`Correct! ${seqRef.current.total}.`, `صحيح! ${seqRef.current.total}.`), tone: "win" }
      : { text: tt(`The answer was ${seqRef.current.total}. `, `الناتج ${seqRef.current.total}. `) + diagnose({ n: 13, decimals: 0 }, seqRef.current.total, isNaN(v) ? 0 : v), tone: "err" })
    setWaiting(false)
  }

  const startExam = () => {
    const items = Array.from({ length: 15 }, () => genSeq(6, Math.random() < 0.5 ? 2 : 3, true))
    setExamItems(items); setExamI(0); setExamOk(0); setExamMode(true)
    examEndRef.current = performance.now() + 180000
    if (examTimerRef.current) clearInterval(examTimerRef.current)
    examTimerRef.current = setInterval(() => {
      const left = Math.max(0, (examEndRef.current - performance.now()) / 1000)
      setExamSecondsLeft(Math.ceil(left))
      if (left <= 0) finishExam(items.length, true)
    }, 250)
    runExamItem(items, 0)
  }
  const runExamItem = (items: { seq: Term[]; total: number }[], idx: number) => {
    if (idx >= items.length) { finishExam(idx, false); return }
    setAnswer("")
    runFlash(items[idx].seq, () => { t0Ref.current = performance.now(); setFlash(tt(`Problem ${idx + 1} of ${items.length} — answer?`, `المسألة ${idx + 1} من ${items.length} — الناتج؟`)) })
  }
  const submitExamAnswer = () => {
    const item = examItems[examI]
    if (!item) return
    const v = parseInt(answer, 10)
    const ok = v === item.total
    if (ok) setExamOk((o) => o + 1)
    session.add({ mode: "anzanExam", ok, ms: null, detail: "أنزان معياري", err: ok ? null : "أنزان" })
    const nextI = examI + 1
    setExamI(nextI)
    runExamItem(examItems, nextI)
  }
  const finishExam = (total: number, timeUp: boolean) => {
    if (examTimerRef.current) clearInterval(examTimerRef.current)
    const pct = total ? Math.round((examOk / total) * 100) : 0
    const grade = pct >= 80 ? tt("Excellent", "امتياز") : pct >= 60 ? tt("Pass", "ناجح") : tt("Not yet", "لم يجتز")
    setFlash("")
    setMsg({ text: `${grade} — ${examOk}/${total} (${pct}%)${timeUp ? tt(" — time's up", " — انتهى الوقت") : ""}.`, tone: pct >= 60 ? "win" : "err" })
    setExamMode(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{tt("Count", "عدد الأرقام")}</span>
        <Select value={String(count)} onValueChange={(v) => setCount(+v)} disabled={running || examMode}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[3, 5, 7, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm font-medium">{tt("Digits", "المنازل")}</span>
        <Select value={String(digitCount)} onValueChange={(v) => setDigitCount(+v)} disabled={running || examMode}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm font-medium">{tt("Speed", "السرعة")}</span>
        <input type="range" min={250} max={2000} step={50} value={speed} onChange={(e) => setSpeed(+e.target.value)} disabled={running || examMode} />
        <span className="text-xs text-muted-foreground tabular-nums">{(speed / 1000).toFixed(2)}s</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2"><Switch checked={allowSub} onCheckedChange={setAllowSub} disabled={running || examMode} /><Label className="text-sm">{tt("Include subtraction", "تضمين الطرح")}</Label></div>
        <div className="flex items-center gap-2"><Switch checked={showBoard} onCheckedChange={setShowBoard} disabled={running || examMode} /><Label className="text-sm">{tt("Show abacus instead of numbers", "اعرض المعداد بدل الأرقام")}</Label></div>
        <div className="flex items-center gap-2"><Switch checked={useVoice} onCheckedChange={setUseVoice} disabled={running || examMode} /><Label className="text-sm">{tt("With voice", "مع صوت")}{!voice.ready && voice.supported === false ? "" : !voice.ready ? tt(" (no Arabic voice found)", " (لا يوجد صوت عربي)") : ""}</Label></div>
        <Button onClick={start} disabled={running || examMode}>{tt("Start", "ابدأ")}</Button>
        <Button variant="outline" onClick={startExam} disabled={running || examMode}>{tt("Standard Anzan exam", "اختبار الأنزان المعياري")}</Button>
      </div>

      {examMode && <p className="text-sm text-muted-foreground">{tt("Time left", "الوقت المتبقي")} {examSecondsLeft}s — {tt("correct", "صحيح")} {examOk} / {examI}</p>}

      <div className="flex h-28 items-center justify-center rounded-lg border bg-muted/40 text-5xl font-bold tabular-nums" dir="ltr">
        {flash || (showBoard && (running || examMode) ? "" : "؟")}
      </div>
      {showBoard && (running || examMode) && <Abacus digits={digits} readOnly />}

      {(waiting || examMode) && (
        <div className="flex items-center gap-2">
          <Input type="text" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={tt("Total", "الناتج")} className="w-40" autoFocus />
          <Button onClick={examMode ? submitExamAnswer : check} disabled={!answer}>{tt("Check", "تحقق")}</Button>
        </div>
      )}

      {msg.text && <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : "text-sm font-medium text-red-600"}>{msg.text}</p>}
    </div>
  )
}
