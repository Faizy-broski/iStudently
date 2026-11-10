"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ImageDown, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { jgApi } from "@/lib/api/jahbadh-grades"
import { jgInfographicsApi } from "@/lib/api/jahbadh-infographics"
import { JG_INFOGRAPHIC_REPORTS, studentCard } from "@/lib/jahbadh"
import { JgBlocked, SectionPage, useJgContext, type JgBase } from "./shared"
import { availability, buildPages, type BuiltPage, type PageCtx } from "./infographics/pages"
import { exportImages, installPrintStyle, printStage, STAGE_ID, STAGE_ROOT_ID, waitForPaint } from "./infographics/export"
import { PAGE_H, PAGE_W, type PageMeta } from "./infographics/palette"

/** «إنفوجرافيك جهبذ» (brief B6-62): 12 designed A4-landscape reports from the class data. Web: /admin|teacher/jahbadh-grades/infographics. */
export function Infographics({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("infographics")} subtitle={t("infographicsSubtitle")}>
      {(sectionId, campusId) => <Body sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

type Job = { kind: "print" | "images"; pages: BuiltPage[]; zipName: string }

const DEFAULT_OFF = new Set(["card"])
const GROUPS = ["subject", "class", "student"] as const

function Body({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [scope, setScope] = useState("final")
  const [compare, setCompare] = useState<string | null>(null)
  const [subjectPick, setSubjectPick] = useState<string | null>(null)
  const [measurePick, setMeasurePick] = useState<string | null>(null)
  const [off, setOff] = useState<Set<string>>(DEFAULT_OFF)
  const [names, setNames] = useState(true)
  const [logo, setLogo] = useState(true)
  const [pickStudents, setPickStudents] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState("")
  const [job, setJob] = useState<Job | null>(null)

  const info = useSWR(["jg-infographics", sectionId, campusId, scope, compare], async () => {
    const res = await jgInfographicsApi.get(sectionId, scope, compare, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  }, { keepPreviousData: true })
  const overview = useSWR(["jg-overview", sectionId, campusId], async () => {
    const res = await jgApi.sectionSubjects(sectionId, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })

  const data = info.data
  const M = data?.model
  const subject = M?.subjects.find((s) => s.id === subjectPick) ?? M?.subjects[0]
  const measure = subject?.measures.find((m) => m.key === measurePick) ?? subject?.measures[0]

  const meta: PageMeta = useMemo(() => {
    const o = overview.data
    const h = o?.settings.header ?? {}
    return {
      school: h.school_name ?? "",
      office: h.education_office ?? "",
      municipality: h.municipality ?? "",
      year: o?.academic_year.name ?? "",
      teacher: h.homeroom_teacher ?? "",
      principal: h.principal ?? "",
      grade: o?.section.grade_level_name ?? "",
      section: o?.section.name ?? "",
    }
  }, [overview.data])
  const logoUrl = logo ? overview.data?.settings.header.logo_url || null : null

  const ctx: PageCtx | null = useMemo(
    () => (M && subject ? { M, meta, opts: { names, logoUrl }, subjectId: subject.id, measureKey: measure?.key, cmp: data?.compare ?? null } : null),
    [M, meta, names, logoUrl, subject, measure?.key, data?.compare],
  )
  const avail = useMemo(() => (ctx ? availability(ctx) : {}), [ctx])
  const selected = useMemo(
    () => new Set(JG_INFOGRAPHIC_REPORTS.filter((r) => !off.has(r.id) && avail[r.id] !== false).map((r) => r.id as string)),
    [off, avail],
  )
  // Students that have a card (a mark in the period).
  const withCard = useMemo(() => (M ? M.students.map((_, i) => i).filter((i) => M.students[i].name && studentCard(M, i)) : []), [M])
  const studentIdx = useMemo(() => (pickStudents ? withCard.filter((i) => picked.has(i)) : withCard), [pickStudents, withCard, picked])
  const pages = useMemo(() => (ctx ? buildPages(ctx, selected, studentIdx) : []), [ctx, selected, studentIdx])

  if (info.error && !data) return <JgBlocked code={(info.error as { code?: string }).code} message={info.error.message} isAdmin={isAdmin} />
  if (!data || !M || !ctx || !subject) return <Skeleton className="h-96 w-full" />

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const hasCardReport = selected.has("card")
  const filteredStudents = withCard.filter((i) => !search.trim() || M.students[i].name.includes(search.trim()))
  const reportsByGroup = (g: (typeof GROUPS)[number]) => JG_INFOGRAPHIC_REPORTS.filter((r) => r.group === g)
  const unavailableNote = (id: string) => (id === "branches" ? t("infNoBranches") : id === "compare" ? t("infNoCompare") : id === "attendance" ? t("infNoAttendance") : "")
  const zipName = `${meta.grade} ${meta.section} ${M.scopeTitle}`.trim()

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("infData")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label={t("infPeriod")}>
                <Select value={scope} onValueChange={(v) => { setScope(v); if (compare === v) setCompare(null) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{data.scopes.map((s) => <SelectItem key={s.value} value={s.value}>{s.title}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t("infCompareWith")}>
                <Select value={compare ?? "none"} onValueChange={(v) => setCompare(v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("infCompareNone")}</SelectItem>
                    {data.scopes.filter((s) => s.value !== scope).map((s) => <SelectItem key={s.value} value={s.value}>{s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("infSubject")}>
                <Select value={subject.id} onValueChange={(v) => { setSubjectPick(v); setMeasurePick(null) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{M.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t("infMeasure")}>
                <Select value={measure?.key} onValueChange={setMeasurePick}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{subject.measures.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("infOptions")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="inf-names">{t("infShowNames")}</Label><Switch id="inf-names" checked={names} onCheckedChange={setNames} /></div>
              <div className="flex items-center justify-between gap-3"><Label htmlFor="inf-logo">{t("infShowLogo")}</Label><Switch id="inf-logo" checked={logo} onCheckedChange={setLogo} disabled={!overview.data?.settings.header.logo_url} /></div>
              {!overview.data?.settings.header.logo_url ? <p className="text-xs text-muted-foreground">{t("infLogoHint")}</p> : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("infReports")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {GROUPS.map((g) => (
                <div key={g}>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{t(`infGroup_${g}`)}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {reportsByGroup(g).map((r) => {
                      const disabled = avail[r.id] === false
                      return (
                        <label key={r.id} className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-muted ${disabled ? "opacity-45" : ""}`}>
                          <Checkbox className="mt-1" checked={selected.has(r.id)} disabled={disabled} onCheckedChange={() => toggle(r.id)} />
                          <span>
                            <b className="block text-sm">{t(`infR_${r.id}`)}</b>
                            <small className="block text-xs leading-5 text-muted-foreground">{disabled ? unavailableNote(r.id) : t(`infD_${r.id}`)}</small>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
              {hasCardReport ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="inf-pick">{t("infPickStudents")}</Label>
                    <Switch id="inf-pick" checked={pickStudents} onCheckedChange={(v) => { setPickStudents(v); if (v && picked.size === 0) setPicked(new Set(withCard)) }} />
                  </div>
                  {pickStudents ? (
                    <>
                      <div className="flex gap-2">
                        <Input placeholder={t("infSearchStudent")} value={search} onChange={(e) => setSearch(e.target.value)} />
                        <Button variant="outline" size="sm" onClick={() => setPicked(new Set(withCard))}>{t("infAll")}</Button>
                        <Button variant="outline" size="sm" onClick={() => setPicked(new Set())}>{t("infNone")}</Button>
                      </div>
                      <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                        {filteredStudents.map((i) => (
                          <label key={i} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                            <Checkbox
                              checked={picked.has(i)}
                              onCheckedChange={(v) => setPicked((prev) => { const n = new Set(prev); if (v) n.add(i); else n.delete(i); return n })}
                            />
                            {M.students[i].name}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : <p className="text-xs text-muted-foreground">{t("infAllStudentsNote", { count: withCard.length })}</p>}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!pages.length || !!job} onClick={() => setJob({ kind: "print", pages, zipName })}>
              <Printer className="size-4" />
              {t("infPrintPdf")}
            </Button>
            <Button variant="outline" disabled={!pages.length || !!job} onClick={() => setJob({ kind: "images", pages, zipName })}>
              <ImageDown className="size-4" />
              {t("infSaveAllImages")}
            </Button>
            <span className="text-sm text-muted-foreground">{t("infPagesCount", { count: pages.length })}</span>
            {info.isValidating ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("infImagesNote")}</p>
        </div>
      </div>

      {pages.length ? (
        <div className="space-y-6">
          {pages.map((p) => (
            <PreviewPage key={p.key} page={p} saveLabel={t("infSaveImage")} disabled={!!job} onImage={() => setJob({ kind: "images", pages: [p], zipName })} />
          ))}
        </div>
      ) : <p className="py-10 text-center text-sm text-muted-foreground">{t("infNoPages")}</p>}

      {job ? <Stage job={job} onDone={() => setJob(null)} /> : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

/** One page, scaled to the available width; rendered only when it is near the viewport (decks can hold dozens of cards). */
function PreviewPage({ page, saveLabel, disabled, onImage }: { page: BuiltPage; saveLabel: string; disabled: boolean; onImage: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_W)))
    ro.observe(el)
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() } }, { rootMargin: "800px" })
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect() }
  }, [])
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{page.title}</h2>
        <Button variant="outline" size="sm" disabled={disabled} onClick={onImage}>
          <ImageDown className="size-4" />
          {saveLabel}
        </Button>
      </div>
      <div ref={wrap} className="w-full overflow-hidden rounded-lg border bg-white shadow-sm" style={{ height: PAGE_H * scale, direction: "ltr" }}>
        {visible ? <div style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>{page.node}</div> : null}
      </div>
    </div>
  )
}

/** Unscaled copy of the chosen pages, mounted only while a print or export job runs (print CSS and html2canvas need real size). */
function Stage({ job, onDone }: { job: Job; onDone: () => void }) {
  const t = useTranslations("grades")
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const remove = installPrintStyle()
    ;(async () => {
      try {
        await waitForPaint()
        if (job.kind === "print") await printStage()
        else if (ref.current) await exportImages(ref.current, job.pages.map((p) => p.file), job.zipName, (done, total) => setProgress({ done, total }))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      } finally {
        remove()
        onDone()
      }
    })()
  }, [job, onDone])
  return createPortal(
    <>
      <div id={STAGE_ROOT_ID}>
        <div id={STAGE_ID} ref={ref}>
          {job.pages.map((p) => (
            <div key={p.key} data-jgi-sheet="" style={{ width: PAGE_W, height: PAGE_H, overflow: "hidden" }}>{p.node}</div>
          ))}
        </div>
      </div>
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background print:hidden">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm font-medium">{job.kind === "print" ? t("infPreparingPrint") : t("infMakingImages")}</p>
        {progress ? <Progress className="w-64" value={(progress.done / Math.max(1, progress.total)) * 100} /> : null}
      </div>
    </>,
    document.body,
  )
}
