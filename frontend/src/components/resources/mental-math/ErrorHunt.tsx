"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Abacus, valueToDigits, digitsToValue, type Digits } from "./Abacus"
import { useTT } from "./useTT"
import { corrupt, placeName } from "@/lib/mentalMath/engine"
import type { useSessionLog } from "./useSessionLog"

interface Hunt {
  target: number
  rod: number
  t0: number
  active: boolean
  awaitingFix: boolean
}

export function ErrorHunt({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [digitCount, setDigitCount] = useState(3)
  const [digits, setDigits] = useState<Digits>(() => valueToDigits(0, 13))
  const [hunt, setHunt] = useState<Hunt | null>(null)
  const [msg, setMsg] = useState<{ text: string; tone: "idle" | "win" | "err" }>({
    text: tt("Press \"New round\" — the abacus will show a slightly wrong number.", "اضغط «تمرين جديد» — سيعرض المعداد عددًا خاطئًا قليلاً."),
    tone: "idle",
  })

  const newRound = () => {
    const min = Math.pow(10, digitCount - 1)
    const max = Math.pow(10, digitCount) - 1
    const val = min + Math.floor(Math.random() * (max - min + 1))
    const base = valueToDigits(val, 13)
    const c = corrupt(base)
    if (!c) {
      setMsg({ text: tt("Couldn't generate a round — try again.", "تعذّر توليد تمرين — حاول مجددًا."), tone: "err" })
      return
    }
    setDigits(c.digits)
    setHunt({ target: val, rod: c.rod, t0: performance.now(), active: true, awaitingFix: false })
    setMsg({ text: tt("Click the rod that holds the error (strip under the beads).", "اضغط على العمود الذي فيه الخطأ (الشريط تحت الخرز)."), tone: "idle" })
  }

  const pickRod = (i: number) => {
    if (!hunt || !hunt.active) return
    const ms = performance.now() - hunt.t0
    const ok = i === hunt.rod
    session.add({ mode: "hunt", ok, ms, detail: "خطأ في " + placeName(13, 0, hunt.rod), err: ok ? null : "تحديد العمود" })
    if (ok) {
      setHunt({ ...hunt, active: false, awaitingFix: true })
      setMsg({ text: tt(`Found it — the error is in ${placeName(13, 0, i)}. Now fix the beads so the value reads ${hunt.target}.`, `أصبت — الخطأ في ${placeName(13, 0, i)}. الآن صحّح الخرز حتى تصبح القيمة ${hunt.target}.`), tone: "win" })
    } else {
      setMsg({ text: tt("Not that rod — compare each place to the target number, right to left.", "ليس هذا العمود — قارن كل منزلة بالعدد المطلوب من اليمين لليسار."), tone: "err" })
    }
  }

  const onAbacusChange = (next: Digits) => {
    setDigits(next)
    if (!hunt || !hunt.awaitingFix) return
    if (digitsToValue(next) === hunt.target) {
      session.add({ mode: "hunt", ok: true, ms: null, detail: "تصحيح " + hunt.target, err: null })
      setHunt(null)
      setMsg({ text: tt(`Excellent — the abacus now correctly reads ${hunt.target}.`, `ممتاز — أصبح المعداد يعرض ${hunt.target} بشكل صحيح.`), tone: "win" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{tt("Number size", "حجم العدد")}</span>
        <Select value={String(digitCount)} onValueChange={(v) => setDigitCount(+v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">{tt("2 digits", "رقمان")}</SelectItem>
            <SelectItem value="3">{tt("3 digits", "ثلاثة أرقام")}</SelectItem>
            <SelectItem value="4">{tt("4 digits", "أربعة أرقام")}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={newRound}>{tt("New round", "تمرين جديد")}</Button>
        {hunt && <span className="text-sm">{tt("Target:", "العدد المطلوب:")} <b className="tabular-nums">{hunt.target}</b></span>}
      </div>

      <Abacus digits={digits} onChange={hunt?.awaitingFix ? onAbacusChange : undefined} onPickRod={hunt?.active ? pickRod : undefined} readOnly={!hunt?.awaitingFix} />

      <p className={msg.tone === "win" ? "text-sm font-medium text-green-600" : msg.tone === "err" ? "text-sm font-medium text-red-600" : "text-sm text-muted-foreground"}>
        {msg.text}
      </p>
    </div>
  )
}
