"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, EyeOff, Printer, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  jgApi, openMyReportCard, openReportCardsPdf,
  type JgReportCardOptions, type JgReportCardSettings, type JgScope,
} from "@/lib/api/jahbadh-grades"
import { decisionTone, fmtMark, fmtPct } from "@/lib/jahbadh"
import { JgBlocked, ResultChip, SectionPicker, useJgContext, useJgSection, SectionsBlocked, sectionsReady, type JgBase } from "./shared"

// The web imports only types from packages/ at runtime, so the option order is listed here.
const OPTION_KEYS: (keyof JgReportCardOptions)[] = [
  "rank", "minPass", "subjectEstimate", "classAverage", "performanceBar", "trend",
  "badges", "insight", "activities", "attendance", "guardianTips", "quote",
]

/** Report cards (brief B7): scope, the 12 options, tips and quotes, print range, publishing. */
export function ReportCards({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const { sections, sectionId, setSection } = useJgSection(campusId)
  const [scope, setScope] = useState<JgScope>("final")

  const overview = useSWR(sectionId ? ["jg-overview", sectionId, campusId] : null, async () => {
    const res = await jgApi.sectionSubjects(sectionId!, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const preview = useSWR(sectionId && overview.data ? ["jg-cards", sectionId, scope, campusId] : null, async () => {
    const res = await jgApi.reportCards(sectionId!, scope, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const settings = useSWR(sectionId ? ["jg-rc-settings", sectionId, campusId] : null, async () => (await jgApi.reportCardSettings(sectionId!, campusId)).data)
  const pubs = useSWR(sectionId ? ["jg-pubs", sectionId, campusId] : null, async () => (await jgApi.publications(sectionId!, campusId)).data ?? [])

  const [form, setForm] = useState<{ options: JgReportCardOptions; tips: string; quotes: string } | null>(null)
  const [seen, setSeen] = useState<JgReportCardSettings | null>(null)
  if (settings.data && settings.data !== seen) {
    setSeen(settings.data)
    setForm({ options: settings.data.options, tips: settings.data.guardian_tips.join("\n"), quotes: settings.data.quotes.join("\n") })
  }
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const ov = overview.data
  const scopes: { value: JgScope; label: string }[] = ov
    ? [
        ...ov.rule.stage_names.map((n, i) => (n ? { value: `stage${i + 1}` as JgScope, label: n } : null)).filter((x): x is { value: JgScope; label: string } => !!x),
        { value: "final", label: t("finalResult") },
      ]
    : []
  const cards = preview.data?.cards ?? []
  const fromN = Number(from) || 1
  const toN = Number(to) || cards.length
  const count = Math.max(0, Math.min(toN, cards.length) - Math.max(fromN, 1) + 1)

  const saveSettings = async () => {
    if (!form) return
    const res = await jgApi.saveReportCardSettings(sectionId!, {
      options: form.options,
      guardian_tips: form.tips.split("\n").map((x) => x.trim()).filter(Boolean),
      quotes: form.quotes.split("\n").map((x) => x.trim()).filter(Boolean),
    }, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    settings.mutate(res.data, false)
  }
  const print = () =>
    openReportCardsPdf(sectionId!, scope, { from: from ? fromN : undefined, to: to ? toN : undefined }, campusId).catch((e) => toast.error(e.message))
  const published = pubs.data?.find((p) => p.scope === scope)
  const togglePublish = async () => {
    const res = published ? await jgApi.unpublish(sectionId!, published.id, campusId) : await jgApi.publish(sectionId!, scope, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(published ? t("unpublished") : t("published"))
    pubs.mutate(res.data, false)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`${base}${sectionId ? `?section=${sectionId}` : ""}`} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("reportCards")}</h1>
            <p className="text-sm text-muted-foreground">{t("reportCardsSubtitle")}</p>
          </div>
        </div>
        {sections.data?.length ? <SectionPicker sections={sections.data} value={sectionId} onChange={setSection} /> : null}
      </div>

      {overview.error ? (
        <JgBlocked code={(overview.error as { code?: string }).code} message={overview.error.message} isAdmin={isAdmin} />
      ) : !sectionsReady(sections) || !sectionId ? (
        <SectionsBlocked sections={sections} isAdmin={isAdmin} />
      ) : !ov ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("printCards")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("scope")}</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as JgScope)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{scopes.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="from">{t("fromNumber")}</Label>
                    <Input id="from" type="number" min={1} placeholder="1" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="to">{t("toNumber")}</Label>
                    <Input id="to" type="number" min={1} placeholder={String(cards.length || "")} value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t("cardsToPrint", { count })}</p>
                <Button className="w-full" onClick={print} disabled={!count}><Printer className="size-4" />{t("printPdf")}</Button>
              </CardContent>
            </Card>

            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("publishing")}</CardTitle>
                  <CardDescription>{t("publishingHint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {scopes.map((s) => {
                    const p = pubs.data?.find((x) => x.scope === s.value)
                    return (
                      <div key={s.value} className="flex items-center justify-between text-sm">
                        <span dir="rtl">{s.label}</span>
                        <ResultChip label={p ? t("publishedOn", { date: new Date(p.published_at).toLocaleDateString() }) : t("notPublished")} tone={p ? "success" : "muted"} />
                      </div>
                    )
                  })}
                  <Button className="w-full" variant={published ? "outline" : "default"} onClick={togglePublish}>
                    {published ? <EyeOff className="size-4" /> : <Send className="size-4" />}
                    {published ? t("unpublishScope") : t("publishScope")}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {form ? (
              <Card>
                <CardHeader><CardTitle className="text-base">{t("cardOptions")}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {OPTION_KEYS.map((k) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <Label htmlFor={`opt-${k}`} className="font-normal">{t(`opt_${k}`)}</Label>
                      <Switch id={`opt-${k}`} checked={form.options[k]} onCheckedChange={(v) => setForm({ ...form, options: { ...form.options, [k]: v } })} />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label htmlFor="tips">{t("guardianTips")}</Label>
                    <Textarea id="tips" dir="auto" rows={4} value={form.tips} onChange={(e) => setForm({ ...form, tips: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quotes">{t("quotes")}</Label>
                    <Textarea id="quotes" dir="auto" rows={4} value={form.quotes} onChange={(e) => setForm({ ...form, quotes: e.target.value })} />
                    <p className="text-xs text-muted-foreground">{t("onePerLine")}</p>
                  </div>
                  <Button className="w-full" variant="outline" onClick={saveSettings}>{t("save")}</Button>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">{t("preview")}</CardTitle></CardHeader>
            <CardContent>
              {preview.error ? <p className="text-sm text-destructive">{preview.error.message}</p> : null}
              {!preview.data ? <Skeleton className="h-64 w-full" /> : (
                <div className="overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="p-2 text-start">#</th>
                        <th className="p-2 text-start">{t("student")}</th>
                        <th className="p-2">{t("overallTotal")}</th>
                        <th className="p-2">{t("percent")}</th>
                        <th className="p-2">{t("estimate")}</th>
                        <th className="p-2">{t("rank")}</th>
                        <th className="p-2">{t("decision")}</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {cards.map((c) => (
                        <tr key={c.student.listNumber} className="border-t">
                          <td className="p-2 tabular-nums">{c.student.listNumber}</td>
                          <td className="p-2" dir="rtl">{c.student.name}</td>
                          <td className="p-2 text-center tabular-nums">{c.total === null ? "—" : `${fmtMark(c.total)} / ${fmtMark(c.max)}`}</td>
                          <td className="p-2 text-center tabular-nums">{fmtPct(c.pct, 1)}</td>
                          <td className="p-2 text-center" dir="rtl">{c.estimate ?? ""}</td>
                          <td className="p-2 text-center tabular-nums">{c.rank ?? ""}</td>
                          <td className="p-2 text-center"><ResultChip label={c.decision} tone={decisionTone(c.decision)} /></td>
                          <td className="p-2">
                            <Button variant="ghost" size="icon" aria-label={t("printPdf")}
                              onClick={() => openReportCardsPdf(sectionId!, scope, { from: c.student.listNumber, to: c.student.listNumber }, campusId).catch((e) => toast.error(e.message))}>
                              <Printer className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!cards.length ? <p className="p-4 text-center text-sm text-muted-foreground">{t("noStudents")}</p> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

/** Students and parents: report cards released by the school. */
export function MyReportCards() {
  const t = useTranslations("grades")
  const list = useSWR("jg-my-cards", async () => {
    const res = await jgApi.myReportCards()
    if (!res.success) throw new Error(res.error)
    return res.data ?? []
  })
  const scopeLabel = (s: JgScope) => (s === "final" ? t("finalResult") : t("stageN", { n: s.slice(5) }))
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">{t("reportCards")}</h1>
        <p className="text-sm text-muted-foreground">{t("myCardsSubtitle")}</p>
      </div>
      {list.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {list.error ? <p className="text-sm text-destructive">{list.error.message}</p> : null}
      {list.data && !list.data.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t("noReleasedCards")}</CardContent></Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {list.data?.map((c) => (
          <Card key={`${c.student_id}-${c.scope}`}>
            <CardContent className="flex items-center justify-between gap-3 pt-6">
              <div>
                <p className="font-semibold" dir="rtl">{c.student_name}</p>
                <p className="text-sm text-muted-foreground">{scopeLabel(c.scope)} · {c.academic_year ?? ""}</p>
              </div>
              <Button variant="outline" onClick={() => openMyReportCard(c.student_id, c.scope).catch((e) => toast.error(e.message))}>
                <Printer className="size-4" />{t("openPdf")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
