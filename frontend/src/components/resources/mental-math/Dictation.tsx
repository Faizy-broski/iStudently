"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useTT } from "./useTT"
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

export function Dictation({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const voice = useMentalMathVoice()
  const [count, setCount] = useState(5)
  const [digitCount, setDigitCount] = useState(1)
  const [allowSub, setAllowSub] = useState(false)
  const [gap, setGap] = useState(1800)
  const [state, setState] = useState("")
  const [answer, setAnswer] = useState("")
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({ text: "", tone: "idle" })
  const seqRef = useRef<{ seq: Term[]; total: number } | null>(null)
  const t0Ref = useRef(0)

  const speakSeq = () => {
    if (!seqRef.current) return
    setState(tt("Listening…", "استمع…"))
    let i = 0
    const step = () => {
      if (i >= seqRef.current!.seq.length) { setState(tt("What's the total?", "ما الناتج؟")); t0Ref.current = performance.now(); return }
      const t = seqRef.current!.seq[i]
      voice.speak((i === 0 ? "" : t.sign === "+" ? tt("plus ", "زائد ") : tt("minus ", "ناقص ")) + toWords(t.v))
      setState(tt(`Number ${i + 1} of ${seqRef.current!.seq.length}`, `العدد ${i + 1} من ${seqRef.current!.seq.length}`))
      i++
      setTimeout(step, gap)
    }
    voice.cancel()
    setTimeout(step, 500)
  }

  const start = () => {
    seqRef.current = genSeq(count, digitCount, allowSub)
    setAnswer(""); setMsg({ text: "", tone: "idle" })
    speakSeq()
  }

  const check = () => {
    if (!seqRef.current) return
    const v = parseInt(answer, 10)
    const ok = v === seqRef.current.total
    session.add({ mode: "dict", ok, ms: null, detail: seqRef.current.seq.map((t, i) => (i ? t.sign : "") + t.v).join(" ") + " = " + seqRef.current.total, err: ok ? null : "إملاء" })
    setMsg(ok
      ? { text: tt(`Correct! ${seqRef.current.total}.`, `صحيح! ${seqRef.current.total}.`), tone: "win" }
      : { text: tt(`The answer was ${seqRef.current.total}. `, `الناتج ${seqRef.current.total}. `) + diagnose({ n: 13, decimals: 0 }, seqRef.current.total, isNaN(v) ? 0 : v), tone: "err" })
  }

  if (!voice.ready) {
    return (
      <p className="text-sm text-muted-foreground">
        {tt("No Arabic voice was found on this device — dictation needs speech synthesis. Try a different device or browser, or use Anzan (visual flash) instead.", "لم يُعثر على صوت عربي على هذا الجهاز — الإملاء يحتاج تحويل نص إلى كلام. جرّب جهازًا أو متصفحًا آخر، أو استخدم الأنزان (الوميض المرئي) بدلاً منه.")}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{tt("Count", "عدد الأرقام")}</span>
        <Select value={String(count)} onValueChange={(v) => setCount(+v)}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[3, 5, 7].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm font-medium">{tt("Digits", "المنازل")}</span>
        <Select value={String(digitCount)} onValueChange={(v) => setDigitCount(+v)}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm font-medium">{tt("Gap", "الفاصل")}</span>
        <input type="range" min={900} max={3500} step={100} value={gap} onChange={(e) => setGap(+e.target.value)} />
        <span className="text-xs text-muted-foreground tabular-nums">{(gap / 1000).toFixed(1)}s</span>
        <div className="flex items-center gap-2"><Switch checked={allowSub} onCheckedChange={setAllowSub} /><Label className="text-sm">{tt("Include subtraction", "تضمين الطرح")}</Label></div>
      </div>
      <div className="flex gap-2">
        <Button onClick={start}>{tt("Start dictation", "ابدأ الإملاء")}</Button>
        <Button variant="outline" onClick={speakSeq} disabled={!seqRef.current}>{tt("Repeat", "أعد السماع")}</Button>
      </div>
      <p className="min-h-9 text-sm text-muted-foreground">{state}</p>
      <div className="flex items-center gap-2">
        <Input type="text" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={tt("Total", "الناتج")} className="w-40" />
        <Button onClick={check} disabled={!answer}>{tt("Check", "تحقق")}</Button>
      </div>
      {msg.text && <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : "text-sm font-medium text-red-600"}>{msg.text}</p>}
    </div>
  )
}
