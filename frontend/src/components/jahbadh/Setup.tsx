"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, ArrowUpCircle, CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jgApi, type JgGradeMapEntry, type JgSettings, type JgSubjectLinks, type JgUpgradePreview } from "@/lib/api/jahbadh-grades"
import { JG_ACT_MODE_LABELS, JG_DEFAULT_MONTH_NAMES, JG_DISTRIBUTION, JG_NO_MONTH, type JgActMode } from "@/lib/jahbadh"
import { useJgContext } from "./shared"

const NONE = "__none__"

/** Admin setup: the school's copy of the memo, grade-level mapping, subject links and settings. */
export function JahbadhSetup() {
  const t = useTranslations("grades")
  const { campusId } = useJgContext()
  const rules = useSWR(["jg-rules", campusId], async () => (await jgApi.rules(campusId)).data)
  const [busy, setBusy] = useState(false)

  const init = async () => {
    setBusy(true)
    const res = await jgApi.setup(campusId)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(t("setupDone", { count: res.data!.grades }))
    rules.mutate()
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/jahbadh-grades" aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t("setup")}</h1>
          <p className="text-sm text-muted-foreground">{t("setupSubtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("step1Title")}</CardTitle>
          <CardDescription>{t("step1Body")}</CardDescription>
        </CardHeader>
        <CardContent>
          {rules.isLoading ? (
            <Skeleton className="h-9 w-48" />
          ) : rules.data?.source === "school" ? (
            <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />{t("step1Done", { count: rules.data.grades.length })}</p>
          ) : (
            <Button onClick={init} disabled={busy}><Sparkles className="size-4" />{t("initButton")}</Button>
          )}
        </CardContent>
      </Card>

      {rules.data?.source === "school" ? <MemoUpgrade onDone={() => rules.mutate()} /> : null}

      <Tabs defaultValue="map">
        <TabsList>
          <TabsTrigger value="map">{t("step2Title")}</TabsTrigger>
          <TabsTrigger value="links">{t("step3Title")}</TabsTrigger>
          <TabsTrigger value="settings">{t("settings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="map"><GradeMap campusId={campusId} /></TabsContent>
        <TabsContent value="links"><SubjectLinksEditor campusId={campusId} ready={rules.data?.source === "school"} /></TabsContent>
        <TabsContent value="settings"><SettingsForm campusId={campusId} /></TabsContent>
      </Tabs>
    </div>
  )
}

function GradeMap({ campusId }: { campusId: string | null }) {
  const t = useTranslations("grades")
  const map = useSWR(["jg-grade-map", campusId], async () => (await jgApi.gradeMap(campusId)).data ?? [])
  const [values, setValues] = useState<Record<string, string>>({})
  // Reset the form when fresh data arrives (adjusting state during render, not in an effect).
  const [seen, setSeen] = useState<unknown>(null)
  if (map.data && map.data !== seen) {
    setSeen(map.data)
    setValues(Object.fromEntries(map.data.map((m: JgGradeMapEntry) => [m.grade_level_id, String(m.grade_code ?? m.suggested_code ?? NONE)])))
  }

  const save = async () => {
    const entries = (map.data ?? []).map((m) => ({ grade_level_id: m.grade_level_id, grade_code: values[m.grade_level_id] && values[m.grade_level_id] !== NONE ? Number(values[m.grade_level_id]) : null }))
    const res = await jgApi.saveGradeMap(entries, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    map.mutate(res.data, false)
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>{t("step2Body")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {map.isLoading ? <Skeleton className="h-40 w-full" /> : null}
        {map.data?.map((m) => (
          <div key={m.grade_level_id} className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium" dir="auto">
              {m.name}
              {m.grade_code === null && m.suggested_code ? <span className="ms-2 text-xs text-muted-foreground">({t("suggested")})</span> : null}
            </span>
            <Select value={values[m.grade_level_id] ?? NONE} onValueChange={(v) => setValues((s) => ({ ...s, [m.grade_level_id]: v }))}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("notFollowing")}</SelectItem>
                {JG_DISTRIBUTION.map((g) => <SelectItem key={g.code} value={String(g.code)}>{g.code}. {g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
        {map.data && !map.data.length ? <p className="text-sm text-muted-foreground">{t("noGradeLevels")}</p> : null}
        <Button onClick={save} disabled={!map.data?.length}>{t("save")}</Button>
      </CardContent>
    </Card>
  )
}

function SubjectLinksEditor({ campusId, ready }: { campusId: string | null; ready: boolean }) {
  const t = useTranslations("grades")
  const map = useSWR(["jg-grade-map", campusId], async () => (await jgApi.gradeMap(campusId)).data ?? [])
  const mapped = (map.data ?? []).filter((m) => m.grade_code !== null)
  const [gradeLevelId, setGradeLevelId] = useState<string | null>(null)
  const links = useSWR(ready && gradeLevelId ? ["jg-links", gradeLevelId, campusId] : null, async () => {
    const res = await jgApi.subjectLinks(gradeLevelId!, campusId)
    if (!res.success) throw new Error(res.error)
    return res.data!
  })
  const [values, setValues] = useState<Record<string, string>>({})
  const [seen, setSeen] = useState<unknown>(null)
  if (links.data && links.data !== seen) {
    setSeen(links.data)
    setValues(Object.fromEntries(links.data.links.map((l: JgSubjectLinks["links"][number]) => [l.jg_subject_id, l.subject_id ?? l.suggested_subject_id ?? NONE])))
  }

  const save = async () => {
    const entries = (links.data?.links ?? []).map((l) => ({ jg_subject_id: l.jg_subject_id, subject_id: values[l.jg_subject_id] && values[l.jg_subject_id] !== NONE ? values[l.jg_subject_id] : null }))
    const res = await jgApi.saveSubjectLinks(gradeLevelId!, entries, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    links.mutate(res.data, false)
  }

  if (!ready) return <Card><CardContent className="py-6 text-sm text-muted-foreground">{t("runStep1First")}</CardContent></Card>
  return (
    <Card>
      <CardHeader>
        <CardDescription>{t("step3Body")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={gradeLevelId ?? undefined} onValueChange={setGradeLevelId}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder={t("pickGradeLevel")} /></SelectTrigger>
          <SelectContent>
            {mapped.map((m) => <SelectItem key={m.grade_level_id} value={m.grade_level_id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {links.error ? <p className="text-sm text-destructive">{links.error.message}</p> : null}
        {links.isLoading ? <Skeleton className="h-40 w-full" /> : null}
        {links.data?.links.map((l) => (
          <div key={l.jg_subject_id} className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium" dir="rtl">{l.name}</span>
            <Select value={values[l.jg_subject_id] ?? NONE} onValueChange={(v) => setValues((s) => ({ ...s, [l.jg_subject_id]: v }))}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("notLinked")}</SelectItem>
                {links.data!.platform_subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
        {links.data ? <Button onClick={save}>{t("save")}</Button> : null}
      </CardContent>
    </Card>
  )
}

const HEADER_FIELDS = ["school_name", "education_office", "sub_office", "municipality", "located_at", "school_number", "principal", "homeroom_teacher", "exams_coordinator", "hijri_year", "logo_url"] as const

function SettingsForm({ campusId }: { campusId: string | null }) {
  const t = useTranslations("grades")
  const settings = useSWR(["jg-settings", campusId], async () => (await jgApi.settings(campusId)).data)
  const [form, setForm] = useState<JgSettings | null>(null)
  const [seen, setSeen] = useState<unknown>(null)
  if (settings.data && settings.data !== seen) {
    setSeen(settings.data)
    setForm(withRuleDefaults(structuredClone(settings.data)))
  }
  if (!form) return <Skeleton className="h-64 w-full" />

  const save = async () => {
    const res = await jgApi.saveSettings(form, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    settings.mutate(res.data, false)
  }
  const rate = (k: "follow_rate" | "excel_rate") => (
    <div className="space-y-1">
      <Label htmlFor={k}>{t(k === "follow_rate" ? "followRate" : "excelRate")}</Label>
      <Input id={k} type="number" min={0} max={100} value={Math.round(form[k] * 100)} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) / 100 })} />
    </div>
  )

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {rate("follow_rate")}
          {rate("excel_rate")}
        </div>
        <div className="space-y-2">
          <Label>{t("scale")}</Label>
          {form.grading_scale.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input className="w-24" type="number" min={0} max={100} aria-label={t("scaleFrom")} value={step.from}
                onChange={(e) => setForm({ ...form, grading_scale: form.grading_scale.map((s, j) => (j === i ? { ...s, from: Number(e.target.value) } : s)) })} />
              <Input dir="auto" aria-label={t("scaleLabel")} value={step.label}
                onChange={(e) => setForm({ ...form, grading_scale: form.grading_scale.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)) })} />
              <Button variant="ghost" size="icon" aria-label={t("remove")} disabled={form.grading_scale.length < 2}
                onClick={() => setForm({ ...form, grading_scale: form.grading_scale.filter((_, j) => j !== i) })}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setForm({ ...form, grading_scale: [...form.grading_scale, { from: 100, label: "" }] })}>
            <Plus className="size-4" />{t("addStep")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("scaleHint")}</p>
        </div>
        <RuleSettings form={form} setForm={setForm} />
        <div className="grid gap-3 sm:grid-cols-2">
          {HEADER_FIELDS.map((f) => (
            <div key={f} className="space-y-1">
              <Label htmlFor={f}>{t(`header_${f}`)}</Label>
              <Input id={f} dir="auto" value={form.header[f] ?? ""} onChange={(e) => setForm({ ...form, header: { ...form.header, [f]: e.target.value } })} />
            </div>
          ))}
        </div>
        <Button onClick={save}>{t("save")}</Button>
      </CardContent>
    </Card>
  )
}

const ALL = "all"

/** Settings saved before the 2026-27 keys existed get the workbook defaults. */
function withRuleDefaults(s: JgSettings): JgSettings {
  return {
    ...s,
    jabr_kasur: s.jabr_kasur ?? true,
    jabr_plus_one: s.jabr_plus_one ?? true,
    act_mode: s.act_mode ?? "average",
    month_names: s.month_names?.length === 3 ? s.month_names : JG_DEFAULT_MONTH_NAMES.map((m) => [...m]),
    default_stage: s.default_stage ?? null,
  }
}

/** Art. 122 options, «حساب الأنشطة الشهرية», month names (4 per stage, «—» hides) and the grid's default stage. */
function RuleSettings({ form, setForm }: { form: JgSettings; setForm: (f: JgSettings) => void }) {
  const t = useTranslations("grades")
  const setMonth = (stage: number, i: number, value: string) =>
    setForm({ ...form, month_names: form.month_names.map((row, s) => (s === stage ? row.map((m, j) => (j === i ? value : m)) : row)) })
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="font-semibold">{t("rulesTitle")}</p>
      {(["jabr_kasur", "jabr_plus_one"] as const).map((k) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <Label htmlFor={k} className="font-normal">{t(k === "jabr_kasur" ? "jabrKasur" : "jabrPlusOne")}</Label>
          <Switch id={k} checked={form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("actMode")}</Label>
          <Select value={form.act_mode} onValueChange={(v) => setForm({ ...form, act_mode: v as JgActMode })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(JG_ACT_MODE_LABELS) as JgActMode[]).map((m) => <SelectItem key={m} value={m}>{JG_ACT_MODE_LABELS[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("defaultStage")}</Label>
          <Select value={form.default_stage ? String(form.default_stage) : ALL} onValueChange={(v) => setForm({ ...form, default_stage: v === ALL ? null : Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allStages")}</SelectItem>
              {[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{t("stageN", { n })}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("monthNames")}</Label>
        {form.month_names.map((row, stage) => (
          <div key={stage} className="grid grid-cols-[5rem_repeat(4,minmax(0,1fr))] items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("stageN", { n: stage + 1 })}</span>
            {row.map((m, i) => (
              <Input key={i} dir="auto" aria-label={`${t("stageN", { n: stage + 1 })} — ${i + 1}`} value={m === JG_NO_MONTH ? "" : m} placeholder={JG_NO_MONTH}
                onChange={(e) => setMonth(stage, i, e.target.value.trim() === "" ? JG_NO_MONTH : e.target.value)} />
            ))}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("monthNamesHint")}</p>
      </div>
    </div>
  )
}

const UPGRADE_TARGET = "2026-2027"

/** Moves the current academic year to the 2026-2027 memo: preview the differences, then apply. */
function MemoUpgrade({ onDone }: { onDone: () => void }) {
  const t = useTranslations("grades")
  const [preview, setPreview] = useState<JgUpgradePreview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const explain = (code: string | undefined, error: string | undefined) =>
    code === "same_version" ? t("upgradeSame", { version: UPGRADE_TARGET })
      : code === "not_seeded" ? t("upgradeNotSeeded")
      : code === "not_migrated" ? t("notMigratedBody")
      : error ?? t("loadError")

  const load = async () => {
    setBusy(true)
    setMessage(null)
    const res = await jgApi.upgradePreview(UPGRADE_TARGET)
    setBusy(false)
    if (!res.success) return setMessage(explain(res.code, res.error))
    setPreview(res.data!)
  }
  const apply = async () => {
    if (!preview || !window.confirm(t("upgradeConfirm", { from: preview.from, to: preview.to }))) return
    setBusy(true)
    const res = await jgApi.upgrade(UPGRADE_TARGET, preview.academic_year.id)
    setBusy(false)
    if (!res.success) return toast.error(explain(res.code, res.error))
    toast.success(t("upgradeDone", { moved: res.data!.marks_moved, unmapped: res.data!.marks_unmapped }))
    setPreview(null)
    setMessage(t("upgradeSame", { version: res.data!.to }))
    onDone()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("upgradeTitle")}</CardTitle>
        <CardDescription>{t("upgradeBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {!preview ? (
          <Button variant="outline" onClick={load} disabled={busy}><ArrowUpCircle className="size-4" />{t("upgradePreview")}</Button>
        ) : (
          <>
            <p className="text-sm">{t("upgradeYear", { year: preview.academic_year.name ?? "", from: preview.from, to: preview.to })}</p>
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs">
                  <tr>
                    <th className="p-2 text-start">{t("gradeLabel")}</th>
                    <th className="p-2">{t("totalBefore")}</th>
                    <th className="p-2">{t("totalAfter")}</th>
                    <th className="p-2 text-start">{t("subjectsAdded")}</th>
                    <th className="p-2 text-start">{t("subjectsRemoved")}</th>
                    <th className="p-2">{t("componentsChanged")}</th>
                    <th className="p-2">{t("marksMoved")}</th>
                    <th className="p-2">{t("marksUnmapped")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.grades.map((g) => (
                    <tr key={g.grade_code} className="border-t">
                      <td className="p-2" dir="rtl">{g.name}</td>
                      <td className="p-2 text-center tabular-nums">{g.total_before ?? "—"}</td>
                      <td className="p-2 text-center font-semibold tabular-nums">{g.total_after}</td>
                      <td className="p-2" dir="rtl">{g.subjects_added.join("، ") || "—"}</td>
                      <td className="p-2" dir="rtl">{g.subjects_removed.join("، ") || "—"}</td>
                      <td className="p-2 text-center tabular-nums" title={g.components_changed.map((c) => `${c.subject}: ${c.before} → ${c.after}`).join("\n")}>{g.components_changed.length}</td>
                      <td className="p-2 text-center tabular-nums">{g.marks}</td>
                      <td className={`p-2 text-center tabular-nums ${g.marks_unmapped ? "font-semibold text-destructive" : ""}`}>{g.marks_unmapped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{t("upgradeHint")}</p>
            <div className="flex gap-2">
              <Button onClick={apply} disabled={busy}><ArrowUpCircle className="size-4" />{t("upgradeApply")}</Button>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>{t("cancel")}</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
