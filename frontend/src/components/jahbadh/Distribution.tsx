"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, Pencil, Save, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { jgApi, type JgGrade } from "@/lib/api/jahbadh-grades"
import { fmtMark, fmtPct } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { useJgContext, type JgBase } from "./shared"

/** The official distribution (brief B6-16 / Appendix A): read-only for teachers, editable by admins (school copy). */
export function Distribution({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const rules = useSWR(["jg-rules", campusId], async () => {
    const res = await jgApi.rules(campusId)
    if (!res.success) throw new Error(res.error)
    return res.data!
  })
  const [code, setCode] = useState(1)
  const [edit, setEdit] = useState<JgGrade | null>(null)
  const grade = rules.data?.grades.find((g) => g.rule.grade_code === code)
  const editable = isAdmin && rules.data?.source === "school"

  const save = async () => {
    if (!edit) return
    const res = await jgApi.updateRule(code, {
      system_name: edit.rule.system_name,
      total_min: Number(edit.rule.total_min),
      exam_min: Number(edit.rule.exam_min),
      rule_text: edit.rule.rule_text,
      certificate_name: edit.rule.certificate_name || null,
      next_grade_name: edit.rule.next_grade_name || null,
      subjects: edit.subjects.map((s) => ({
        id: s.id,
        name: s.name,
        weekly_periods: Number(s.weekly_periods),
        components: s.components.map(({ id, stage, sort_order, name, max_score, is_exam }) => ({ id, stage, sort_order, name, max_score: Number(max_score), is_exam })),
      })),
    }, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setEdit(null)
    rules.mutate()
  }

  const view = edit ?? grade
  const patchRule = (p: Partial<JgGrade["rule"]>) => setEdit((e) => (e ? { ...e, rule: { ...e.rule, ...p } } : e))
  const patchComp = (sid: string, cid: string, p: Record<string, unknown>) =>
    setEdit((e) => e && { ...e, subjects: e.subjects.map((s) => (s.id !== sid ? s : { ...s, components: s.components.map((c) => (c.id === cid ? { ...c, ...p } : c)) })) })

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={base} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("distribution")}</h1>
            <p className="text-sm text-muted-foreground">{t("distributionSubtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={String(code)} onValueChange={(v) => { setCode(Number(v)); setEdit(null) }}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {rules.data?.grades.map((g) => <SelectItem key={g.rule.grade_code} value={String(g.rule.grade_code)}>{g.rule.grade_code}. {g.rule.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {editable && grade ? (
            edit ? (
              <>
                <Button onClick={save}><Save className="size-4" />{t("save")}</Button>
                <Button variant="outline" onClick={() => setEdit(null)}><X className="size-4" />{t("cancel")}</Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEdit(structuredClone(grade))}><Pencil className="size-4" />{t("edit")}</Button>
            )
          ) : null}
        </div>
      </div>
      {rules.data?.source === "template" ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t("templateNote")}</p> : null}

      {rules.isLoading || !view ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-3 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t("system")} value={view.rule.system_name} editing={!!edit} onChange={(v) => patchRule({ system_name: v })} />
              <Field label={t("totalMin")} value={edit ? String(Math.round(view.rule.total_min * 100)) : view.rule.no_fail ? t("noFailShort") : fmtPct(view.rule.total_min)} editing={!!edit && !view.rule.no_fail} type="number" onChange={(v) => patchRule({ total_min: Number(v) / 100 })} />
              <Field label={t("examMin")} value={edit ? String(Math.round(view.rule.exam_min * 100)) : view.rule.exam_min ? fmtPct(view.rule.exam_min) : "—"} editing={!!edit && !view.rule.no_fail} type="number" onChange={(v) => patchRule({ exam_min: Number(v) / 100 })} />
              <Field label={t("certificateOrNext")} value={view.rule.certificate_name ?? view.rule.next_grade_name ?? "—"} editing={false} onChange={() => {}} />
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-xs text-muted-foreground">{t("ruleText")}</p>
                {edit ? (
                  <Textarea dir="rtl" value={view.rule.rule_text} onChange={(e) => patchRule({ rule_text: e.target.value })} />
                ) : (
                  <p className="rounded-lg bg-muted p-2" dir="rtl">{view.rule.rule_text}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {view.subjects.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span dir="rtl">{s.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {t("subjectMeta", { max: fmtMark(s.components.reduce((a, c) => a + Number(c.max_score), 0)), periods: s.weekly_periods })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      {[1, 2, 3].map((stage) => {
                        const comps = s.components.filter((c) => c.stage === stage)
                        if (!comps.length) return null
                        return comps.map((c, i) => (
                          <tr key={c.id} className="border-b last:border-0">
                            {i === 0 ? <td rowSpan={comps.length} className="w-28 p-1 align-top text-xs text-muted-foreground" dir="rtl">{view.rule.stage_names[stage - 1]}</td> : null}
                            <td className="p-1" dir="rtl">
                              {edit ? <Input className="h-8" dir="rtl" value={c.name} onChange={(e) => patchComp(s.id, c.id, { name: e.target.value })} /> : c.name}
                            </td>
                            <td className="w-20 p-1 text-center tabular-nums">
                              {edit ? <Input className="h-8 text-center" type="number" step="0.5" value={c.max_score} onChange={(e) => patchComp(s.id, c.id, { max_score: e.target.value })} /> : fmtMark(c.max_score)}
                            </td>
                            <td className="w-20 p-1 text-center">
                              {edit ? (
                                <Switch checked={c.is_exam} onCheckedChange={(v) => patchComp(s.id, c.id, { is_exam: v })} aria-label={t("exam")} />
                              ) : c.is_exam ? (
                                <span className={cn("rounded bg-primary/10 px-1.5 text-xs text-primary")}>★ {t("exam")}</span>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, value, editing, onChange, type }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {editing ? <Input className="h-8" dir="auto" type={type} value={value} onChange={(e) => onChange(e.target.value)} /> : <p className="font-semibold" dir="auto">{value}</p>}
    </div>
  )
}
