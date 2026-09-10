"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTT } from "./useTT"
import { errKind } from "@/lib/mentalMath/engine"
import type { useSessionLog } from "./useSessionLog"

interface Kyu {
  n: number
  digits: number
  terms: number
  count: number
  mins: number
  mul: string | null
  div: string | null
  pass: number
  label: { en: string; ar: string }
}

const KYU: Kyu[] = [
  { n: 10, digits: 2, terms: 5, count: 10, mins: 8, mul: null, div: null, pass: 60, label: { en: "Kyu 10 — Beginner: add/subtract only", ar: "كيو 10 — مبتدئ: جمع وطرح فقط" } },
  { n: 9, digits: 2, terms: 10, count: 10, mins: 10, mul: "2x1", div: null, pass: 60, label: { en: "Kyu 9 — multiplication begins", ar: "كيو 9 — يبدأ الضرب" } },
  { n: 8, digits: 2, terms: 10, count: 10, mins: 12, mul: "3x1", div: "2x1", pass: 60, label: { en: "Kyu 8 — division begins", ar: "كيو 8 — تبدأ القسمة" } },
  { n: 7, digits: 2, terms: 15, count: 10, mins: 14, mul: "2x2", div: "3x1", pass: 60, label: { en: "Kyu 7 — fifteen terms", ar: "كيو 7 — خمسة عشر حدًا" } },
  { n: 6, digits: 3, terms: 10, count: 10, mins: 14, mul: "2x2", div: "4x2", pass: 70, label: { en: "Kyu 6 — three digits", ar: "كيو 6 — ثلاث منازل" } },
  { n: 5, digits: 4, terms: 10, count: 10, mins: 16, mul: "3x2", div: "4x2", pass: 70, label: { en: "Kyu 5 — four digits", ar: "كيو 5 — أربع منازل" } },
]

interface AddItem { kind: "add"; terms: number[]; answer: number }
interface MulDivItem { kind: "mul" | "div"; a: number; b: number; answer: number }
type ExamItem = AddItem | MulDivItem

function randDigits(n: number) {
  const min = Math.pow(10, n - 1)
  const max = Math.pow(10, n) - 1
  return min + Math.floor(Math.random() * (max - min + 1))
}
function addItem(cfg: Kyu): AddItem {
  const min = Math.pow(10, cfg.digits - 1)
  const max = Math.pow(10, cfg.digits) - 1
  const terms: number[] = []
  let run = 0
  for (let i = 0; i < cfg.terms; i++) {
    let v = min + Math.floor(Math.random() * (max - min + 1))
    if (i > 0 && Math.random() < 0.3 && run > v) v = -v
    run += v
    terms.push(v)
  }
  return { kind: "add", terms, answer: run }
}
function mulDivItem(kind: "mul" | "div", shape: string): MulDivItem {
  const [ad, bd] = shape.split("x").map(Number)
  if (kind === "mul") {
    const a = randDigits(ad), b = randDigits(bd)
    return { kind, a, b, answer: a * b }
  }
  const b = randDigits(bd)
  const q = randDigits(Math.max(1, ad - bd))
  return { kind, a: b * q, b, answer: q }
}

export function LevelExam({ session }: { session: ReturnType<typeof useSessionLog> }) {
  const tt = useTT()
  const [kyuN, setKyuN] = useState(10)
  const [studentName, setStudentName] = useState("")
  const [running, setRunning] = useState(false)
  const [items, setItems] = useState<ExamItem[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [result, setResult] = useState<{ right: number; total: number; pct: number; grade: string; cfg: Kyu } | null>(null)
  const endRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const left = Math.max(0, (endRef.current - performance.now()) / 1000)
      setSecondsLeft(Math.ceil(left))
      if (left <= 0) { clearInterval(id); grade() }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const start = () => {
    const cfg = KYU.find((k) => k.n === kyuN)!
    const list: ExamItem[] = []
    for (let i = 0; i < cfg.count; i++) list.push(addItem(cfg))
    if (cfg.mul) for (let i = 0; i < 5; i++) list.push(mulDivItem("mul", cfg.mul))
    if (cfg.div) for (let i = 0; i < 5; i++) list.push(mulDivItem("div", cfg.div))
    setItems(list); setAnswers(new Array(list.length).fill(""))
    endRef.current = performance.now() + cfg.mins * 60000
    setResult(null); setRunning(true)
  }

  const grade = () => {
    setRunning(false)
    const cfg = KYU.find((k) => k.n === kyuN)!
    let right = 0
    items.forEach((it, i) => {
      const a = parseInt(answers[i], 10)
      const ok = a === it.answer
      if (ok) right++
      session.add({ mode: "exam", ok, ms: null, detail: `كيو ${cfg.n}`, err: ok ? null : isNaN(a) ? "لم يُجب" : errKind(it.answer, a) })
    })
    const pct = Math.round((right / items.length) * 100)
    const grade = pct >= cfg.pass + 15 ? tt("Excellent", "امتياز") : pct >= cfg.pass ? tt("Pass", "ناجح") : tt("Not yet", "لم يجتز")
    setResult({ right, total: items.length, pct, grade, cfg })
  }

  const printCertificate = () => {
    if (!result) return
    const w = window.open("", "_blank", "width=800,height=600")
    if (!w) return
    const name = studentName.trim() || tt("Student", "الطالب")
    const date = new Date().toLocaleDateString()
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${tt("Certificate", "شهادة")}</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:40px}h1{font-size:26px}p{font-size:18px;line-height:2}</style>
      </head><body>
      <h1>${tt("Certificate of Achievement", "شهادة اجتياز")}</h1>
      <p>${tt("Mental Math — Level Exam", "الحساب الذهني — اختبار مستوى")}</p>
      <p>${tt("This certifies that", "تشهد هذه الشهادة بأن")} <b>${name}</b><br/>
      ${tt(`passed ${result.cfg.label.en}`, `اجتاز ${result.cfg.label.ar}`)}<br/>
      ${tt(`with a score of ${result.right}/${result.total} (${result.pct}%) — ${result.grade}`, `بنتيجة ${result.right}/${result.total} (${result.pct}٪) — ${result.grade}`)}</p>
      <p>${date}</p>
      <button onclick="window.print()" style="margin-top:20px;padding:8px 16px">${tt("Print", "طباعة")}</button>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      {!running && !result && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(kyuN)} onValueChange={(v) => setKyuN(+v)}>
            <SelectTrigger className="w-96"><SelectValue /></SelectTrigger>
            <SelectContent>{KYU.map((k) => <SelectItem key={k.n} value={String(k.n)}>{tt(k.label.en, k.label.ar)}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder={tt("Student name", "اسم الطالب")} className="w-52" />
          <Button onClick={start}>{tt("Start exam", "ابدأ الاختبار")}</Button>
        </div>
      )}

      {running && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold tabular-nums">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>
            <Button variant="outline" onClick={grade}>{tt("Submit", "سلّم الورقة")}</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{tt("Problem", "مسألة")} {i + 1}</div>
                <div className="my-1 font-mono text-sm" dir="ltr">
                  {it.kind === "add" ? it.terms.map((v, j) => <div key={j}>{j ? (v >= 0 ? "+ " + v : "− " + Math.abs(v)) : v}</div>) : `${it.a} ${it.kind === "div" ? "÷" : "×"} ${it.b}`}
                </div>
                <Input
                  type="text" inputMode="numeric" className="w-full"
                  value={answers[i]}
                  onChange={(e) => setAnswers((a) => a.map((x, k) => (k === i ? e.target.value : x)))}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {result && (
        <div className="space-y-3 rounded-lg border p-6 text-center">
          <p className="text-lg font-semibold">{result.grade}</p>
          <p className="text-3xl font-bold tabular-nums">{result.right} / {result.total} ({result.pct}%)</p>
          <p className="text-sm text-muted-foreground">{tt(`Pass threshold: ${result.cfg.pass}%`, `عتبة النجاح: ${result.cfg.pass}٪`)}</p>
          <div className="flex justify-center gap-2">
            {result.pct >= result.cfg.pass && <Button onClick={printCertificate}>{tt("Print certificate", "اطبع الشهادة")}</Button>}
            <Button variant="outline" onClick={() => setResult(null)}>{tt("New exam", "اختبار جديد")}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
