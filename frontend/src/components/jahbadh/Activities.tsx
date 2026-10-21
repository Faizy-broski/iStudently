"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jgApi, type JgActivities, type JgActivityInput } from "@/lib/api/jahbadh-grades"
import { JgBlocked, SectionPicker, useJgContext, useJgSection, SectionsBlocked, sectionsReady, type JgBase } from "./shared"

const NONE = "__none__"
type Row = Omit<JgActivityInput, "excused_days" | "unexcused_days"> & { excused_days: string; unexcused_days: string }

/** Activities & behaviour (brief B6-9): art / music / PE levels, absence days and notes per stage; school days. */
export function Activities({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const { sections, sectionId, setSection } = useJgSection(campusId)
  const [stage, setStage] = useState(1)
  const data = useSWR(sectionId ? ["jg-activities", sectionId, stage, campusId] : null, async () => {
    const res = await jgApi.activities(sectionId!, stage, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [days, setDays] = useState("")
  const [seen, setSeen] = useState<JgActivities | null>(null)
  const [saving, setSaving] = useState(false)
  if (data.data && data.data !== seen) {
    setSeen(data.data)
    setDays(data.data.school_days === null ? "" : String(data.data.school_days))
    setRows(Object.fromEntries(data.data.rows.map((r) => [r.student.id, {
      student_id: r.student.id, art: r.art, music: r.music, pe: r.pe, teacher_note: r.teacher_note,
      excused_days: r.excused_days === null ? "" : String(r.excused_days), unexcused_days: r.unexcused_days === null ? "" : String(r.unexcused_days),
    }])))
  }
  const d = data.data
  const patch = (id: string, p: Partial<Row>) => setRows((s) => ({ ...s, [id]: { ...s[id], ...p } }))
  const num = (v: string) => (v.trim() === "" ? null : Number(v))

  const save = async () => {
    setSaving(true)
    const res = await jgApi.saveActivities(sectionId!, stage, {
      school_days: num(days),
      entries: Object.values(rows).map((r) => ({ ...r, excused_days: num(r.excused_days), unexcused_days: num(r.unexcused_days) })),
    }, campusId)
    setSaving(false)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    data.mutate(res.data, false)
  }

  const levelSelect = (id: string, key: "art" | "music" | "pe") => (
    <Select value={rows[id]?.[key] ?? NONE} onValueChange={(v) => patch(id, { [key]: v === NONE ? null : v } as Partial<Row>)}>
      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {d?.levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`${base}${sectionId ? `?section=${sectionId}` : ""}`} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("activities")}</h1>
            <p className="text-sm text-muted-foreground">{t("activitiesSubtitle")}</p>
          </div>
        </div>
        {sections.data?.length ? <SectionPicker sections={sections.data} value={sectionId} onChange={setSection} /> : null}
      </div>

      {data.error ? (
        <JgBlocked code={(data.error as { code?: string }).code} message={data.error.message} isAdmin={isAdmin} />
      ) : !sectionsReady(sections) || !sectionId ? (
        <SectionsBlocked sections={sections} isAdmin={isAdmin} />
      ) : !d ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <Tabs value={String(stage)} onValueChange={(v) => setStage(Number(v))}>
              <TabsList>
                {d.stages.map((s) => <TabsTrigger key={s} value={String(s)}>{d.stage_names[s - 1]}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <div className="space-y-1">
              <Label htmlFor="days">{t("schoolDays")}</Label>
              <Input id="days" className="w-32" type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <Button onClick={save} disabled={saving}><Save className="size-4" />{saving ? t("saving") : t("save")}</Button>
          </div>
          <div className="overflow-auto rounded-xl border">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead className="bg-card">
                <tr>
                  <th className="border p-2">#</th>
                  <th className="min-w-48 border p-2 text-start">{t("student")}</th>
                  {d.activity_subjects.map((n) => <th key={n} className="border p-2 text-xs" dir="rtl">{n}</th>)}
                  <th className="border p-2 text-xs">{t("excusedDays")}</th>
                  <th className="border p-2 text-xs">{t("unexcusedDays")}</th>
                  <th className="min-w-64 border p-2 text-xs">{t("teacherNote")}</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={r.student.id} className="even:bg-muted/30">
                    <td className="border p-1 text-center tabular-nums">{i + 1}</td>
                    <td className="border p-1 whitespace-nowrap" dir="rtl">{r.student.name}</td>
                    <td className="border p-1">{levelSelect(r.student.id, "art")}</td>
                    <td className="border p-1">{levelSelect(r.student.id, "music")}</td>
                    <td className="border p-1">{levelSelect(r.student.id, "pe")}</td>
                    {(["excused_days", "unexcused_days"] as const).map((k) => (
                      <td key={k} className="border p-1">
                        <Input className="h-8 w-20 text-center" type="number" min={0} aria-label={t(k === "excused_days" ? "excusedDays" : "unexcusedDays")}
                          value={rows[r.student.id]?.[k] ?? ""} onChange={(e) => patch(r.student.id, { [k]: e.target.value } as Partial<Row>)} />
                      </td>
                    ))}
                    <td className="border p-1">
                      <Input className="h-8" dir="auto" maxLength={500} aria-label={t("teacherNote")}
                        value={rows[r.student.id]?.teacher_note ?? ""} onChange={(e) => patch(r.student.id, { teacher_note: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
