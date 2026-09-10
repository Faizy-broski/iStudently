"use client"

// Printable worksheet generator. Prints via a separate window rather than
// @media-print CSS scoped into the current page — the current page sits
// inside the full dashboard shell (sidebar/topbar), and this avoids having
// to touch that shared chrome's styling just for one tab of one resource.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTT } from "./useTT"

type Kind = "add" | "mul" | "div" | "mix"

interface AddItem { kind: "add"; terms: { sign: "+" | "-"; v: number }[]; answer: number }
interface MulItem { kind: "mul"; a: number; b: number; answer: number }
interface DivItem { kind: "div"; a: number; b: number; answer: number }
type Item = AddItem | MulItem | DivItem

function randDigits(n: number) {
  const min = Math.pow(10, n - 1)
  const max = Math.pow(10, n) - 1
  return min + Math.floor(Math.random() * (max - min + 1))
}

function buildItems(kind: Kind, count: number, digits: number, terms: number): Item[] {
  const items: Item[] = []
  for (let i = 0; i < count; i++) {
    let k: "add" | "mul" | "div" = kind === "mix" ? (["add", "mul", "div"] as const)[Math.floor(Math.random() * 3)] : kind
    if (k === "add") {
      const t: { sign: "+" | "-"; v: number }[] = []
      let run = 0
      for (let j = 0; j < terms; j++) {
        const v = randDigits(digits)
        const sign: "+" | "-" = j > 0 && Math.random() < 0.3 && run > v ? "-" : "+"
        run = sign === "+" ? run + v : run - v
        t.push({ sign, v })
      }
      items.push({ kind: "add", terms: t, answer: run })
    } else if (k === "mul") {
      const a = randDigits(digits)
      const b = randDigits(Math.max(1, digits - 1))
      items.push({ kind: "mul", a, b, answer: a * b })
    } else {
      const b = randDigits(Math.max(1, digits - 1))
      const q = randDigits(Math.max(1, digits - Math.max(1, digits - 1) + 1 || 1))
      items.push({ kind: "div", a: b * q, b, answer: q })
    }
  }
  return items
}

function renderCell(item: Item, index: number, tt: (en: string, ar: string) => string): string {
  const body =
    item.kind === "add"
      ? item.terms.map((t, j) => `<div>${j ? (t.sign === "+" ? "+ " : "− ") : ""}${t.v}</div>`).join("")
      : `<div>${item.a} ${item.kind === "div" ? "÷" : "×"} ${item.b}</div>`
  return `<div class="cell"><div class="num">${index + 1}</div><div class="body">${body}</div><div class="line"></div></div>`
}

export function Worksheet() {
  const tt = useTT()
  const [kind, setKind] = useState<Kind>("add")
  const [count, setCount] = useState(20)
  const [digits, setDigits] = useState(2)
  const [terms, setTerms] = useState(5)
  const [title, setTitle] = useState("")
  const [items, setItems] = useState<Item[] | null>(null)

  const build = () => setItems(buildItems(kind, count, digits, terms))

  const print = () => {
    if (!items) return
    const w = window.open("", "_blank", "width=900,height=1200")
    if (!w) return
    const cells = items.map((it, i) => renderCell(it, i, tt)).join("")
    const keys = items.map((it, i) => `<span>${i + 1}) ${it.answer}</span>`).join(" ")
    w.document.write(`<!doctype html><html dir="ltr"><head><meta charset="utf-8"><title>${title || tt("Mental Math Worksheet", "ورقة تمرين حساب ذهني")}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        .head{border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:16px}
        .meta{font-size:12px;color:#444;margin-top:6px}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .cell{border:1px solid #ccc;border-radius:8px;padding:8px;min-height:90px;position:relative}
        .num{position:absolute;top:4px;left:6px;font-size:11px;color:#777}
        .body{direction:ltr;text-align:left;font-variant-numeric:tabular-nums;font-size:15px;line-height:1.5;margin-top:14px}
        .line{border-top:1.5px solid #333;margin-top:8px;height:20px}
        .key{margin-top:16px;border-top:1px dashed #999;padding-top:10px;font-size:12px;color:#333;display:flex;flex-wrap:wrap;gap:10px;direction:ltr}
        @media print { .noprint { display:none } }
      </style></head>
      <body>
        <div class="head"><b>${title || tt("Mental Math Worksheet", "ورقة تمرين حساب ذهني")}</b>
        <div class="meta">${tt("Name", "الاسم")}: ................................ ${tt("Class", "الصف")}: ............ ${tt("Date", "التاريخ")}: ............ ${tt("Time", "الزمن")}: ....... min</div></div>
        <div class="grid">${cells}</div>
        <div class="key"><b>${tt("Answer key:", "مفتاح الإجابات:")}</b> ${keys}</div>
        <button class="noprint" onclick="window.print()" style="margin-top:16px;padding:8px 16px">${tt("Print", "طباعة")}</button>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="add">{tt("Add/Subtract", "جمع وطرح")}</SelectItem>
            <SelectItem value="mul">{tt("Multiplication", "ضرب")}</SelectItem>
            <SelectItem value="div">{tt("Division", "قسمة")}</SelectItem>
            <SelectItem value="mix">{tt("Mixed", "مختلط")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(count)} onValueChange={(v) => setCount(+v)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[10, 20, 30, 40].map((n) => <SelectItem key={n} value={String(n)}>{n} {tt("problems", "مسألة")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(digits)} onValueChange={(v) => setDigits(+v)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} {tt("digits", "منازل")}</SelectItem>)}</SelectContent>
        </Select>
        {kind === "add" && (
          <Select value={String(terms)} onValueChange={(v) => setTerms(+v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{[3, 5, 8, 10].map((n) => <SelectItem key={n} value={String(n)}>{n} {tt("terms", "حدود")}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tt("Worksheet title (optional)", "عنوان الورقة (اختياري)")} className="w-64" />
        <Button onClick={build}>{tt("Generate worksheet", "ولّد الورقة")}</Button>
        <Button variant="outline" onClick={print} disabled={!items}>{tt("Print worksheet", "اطبع الورقة")}</Button>
      </div>
      {items && <p className="text-sm text-green-600">{tt(`${items.length} problems ready — click "Print worksheet".`, `${items.length} مسألة جاهزة — اضغط «اطبع الورقة».`)}</p>}
    </div>
  )
}
