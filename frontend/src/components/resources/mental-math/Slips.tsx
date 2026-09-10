"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTT } from "./useTT"
import { diagnose } from "@/lib/mentalMath/engine"
import type { useSessionLog } from "./useSessionLog"

export function Slips({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [pageCount, setPageCount] = useState(5)
  const [perPage, setPerPage] = useState(5)
  const [digitCount, setDigitCount] = useState(3)
  const [pages, setPages] = useState<number[][]>([])
  const [i, setI] = useState(0)
  const [total, setTotal] = useState(0)
  const [t0, setT0] = useState(0)
  const [answer, setAnswer] = useState("")
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({
    text: tt("Add page by page — you can't go back, keep the running total in your head or on the abacus.", "اجمع صفحة بصفحة — لا يمكن الرجوع، احتفظ بالمجموع الجاري في ذهنك أو على المعداد."),
    tone: "idle",
  })

  const start = () => {
    const min = Math.pow(10, digitCount - 1)
    const max = Math.pow(10, digitCount) - 1
    let sum = 0
    const list: number[][] = []
    for (let p = 0; p < pageCount; p++) {
      const row: number[] = []
      for (let k = 0; k < perPage; k++) {
        const v = min + Math.floor(Math.random() * (max - min + 1))
        row.push(v); sum += v
      }
      list.push(row)
    }
    setPages(list); setTotal(sum); setI(0); setT0(performance.now()); setAnswer("")
    setMsg({ text: tt("Don't lose the running total — no going back to a previous page.", "لا تُضِع المجموع الجاري — لا رجوع إلى صفحة سابقة."), tone: "idle" })
  }

  const check = () => {
    const v = parseInt(answer, 10)
    const ok = v === total
    const ms = performance.now() - t0
    session.add({ mode: "slips", ok, ms, detail: "قسائم: مجموع " + total, err: ok ? null : "قسائم" })
    setMsg(ok
      ? { text: tt(`Correct — total ${total} in ${(ms / 1000).toFixed(1)}s.`, `صحيح — المجموع ${total} في ${(ms / 1000).toFixed(1)} ث.`), tone: "win" }
      : { text: tt(`The correct total was ${total}. `, `المجموع الصحيح ${total}. `) + diagnose({ n: 13, decimals: 0 }, total, isNaN(v) ? 0 : v), tone: "err" })
    setPages([])
  }

  const onGoing = pages.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{tt("Pages", "عدد القسائم")}</span>
        <Select value={String(pageCount)} onValueChange={(v) => setPageCount(+v)} disabled={onGoing}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[3, 5, 8, 10].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm font-medium">{tt("Numbers per page", "أعداد في كل قسيمة")}</span>
        <Select value={String(perPage)} onValueChange={(v) => setPerPage(+v)} disabled={onGoing}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[3, 5, 8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm font-medium">{tt("Digits", "المنازل")}</span>
        <Select value={String(digitCount)} onValueChange={(v) => setDigitCount(+v)} disabled={onGoing}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{[2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={start} disabled={onGoing}>{tt("Start", "ابدأ")}</Button>
      </div>

      <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border bg-muted/40 p-4 text-xl font-bold tabular-nums" dir="ltr">
        {onGoing ? (
          <>
            <div className="mb-2 text-xs font-normal text-muted-foreground">{tt(`Page ${i + 1} of ${pages.length}`, `القسيمة ${i + 1} من ${pages.length}`)}</div>
            {pages[i].map((v, k) => <div key={k}>{v}</div>)}
          </>
        ) : (
          <span className="text-sm font-normal text-muted-foreground">{tt("Not running", "لا يوجد تمرين جارٍ")}</span>
        )}
      </div>

      {onGoing && (
        i + 1 < pages.length ? (
          <Button onClick={() => setI((n) => n + 1)}>{tt("Next page (no going back)", "القسيمة التالية (لا رجوع)")}</Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input type="text" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={tt("Grand total", "المجموع الكلي")} className="w-40" autoFocus />
            <Button onClick={check} disabled={!answer}>{tt("Check", "تحقق")}</Button>
          </div>
        )
      )}

      <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : msg.tone === "err" ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>{msg.text}</p>
    </div>
  )
}
