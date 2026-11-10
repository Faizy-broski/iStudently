"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { jgDataApi, type JgRolloverKind, type JgRolloverPreview, type JgRolloverResult } from "@/lib/api/jahbadh-data"
import { fmtPct } from "@/lib/jahbadh"
import { JgBlocked, ResultChip, SectionPage, Tile, useSectionResource, type JgBase } from "./shared"

const KIND_TONE: Record<JgRolloverKind, "success" | "destructive" | "warning" | "muted"> = { promote: "success", graduate: "success", repeat: "destructive", hold: "warning" }

/** «النقل للعام القادم» (brief B6 #29): next year's plan per student, carried out by the school's year-end rollover. Admin only. */
export function Rollover({ base }: { base: JgBase }) {
  const t = useTranslations("jgData")
  return (
    <SectionPage base={base} title={t("rolloverTitle")} subtitle={t("rolloverSubtitle")}>
      {(sectionId, campusId) => <RolloverBody key={sectionId} sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function RolloverBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("jgData")
  const preview = useSectionResource<JgRolloverPreview>(["jg-rollover", sectionId, campusId], () => jgDataApi.rolloverPreview(sectionId, campusId))
  const [next, setNext] = useState<Record<string, string>>({})
  const [held, setHeld] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<JgRolloverResult | null>(null)
  const [busy, setBusy] = useState(false)

  const err = preview.error as (Error & { code?: string }) | undefined
  if (err) return <JgBlocked code={err.code} message={err.message} isAdmin />
  const data = preview.data
  if (!data) return <Skeleton className="h-96 w-full" />

  const apply = async () => {
    setBusy(true)
    const students = data.rows.map((r) => ({
      student_id: r.student.id,
      next_grade_id: next[r.student.id] ?? undefined,
      hold: held[r.student.id] ?? undefined,
    })).filter((s) => s.next_grade_id !== undefined || s.hold !== undefined)
    const res = await jgDataApi.rolloverApply(sectionId, students, campusId)
    setBusy(false)
    if (!res.success) return toast.error(res.code === "no_enrollment" ? t("err_no_enrollment") : res.code === "invalid_next_grade" ? t("err_invalid_next_grade") : res.error)
    setResult(res.data!)
    toast.success(t("rolloverSaved"))
    preview.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(["promote", "repeat", "graduate", "hold"] as JgRolloverKind[]).map((k) => <Tile key={k} label={t(`kind_${k}`)} value={data.counts[k] ?? 0} tone={KIND_TONE[k]} />)}
      </div>
      <p className="rounded-lg bg-muted p-3 text-sm">
        {t("rolloverNote")}{" "}
        <Link href="/admin/rollover" className="inline-flex items-center gap-1 font-medium text-primary underline">{t("openRollover")}<ExternalLink className="size-3.5" /></Link>
      </p>
      <Card>
        <CardContent className="overflow-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("decision")}</TableHead>
                <TableHead>{t("percent")}</TableHead>
                <TableHead>{t("plan")}</TableHead>
                <TableHead>{t("enrollment")}</TableHead>
                <TableHead>{t("nextGrade")}</TableHead>
                <TableHead>{t("hold")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r, i) => {
                const chosen = next[r.student.id] ?? r.next_grade_id ?? ""
                const needsTrack = r.kind === "promote" && !chosen && data.next_grade_options.length > 1
                return (
                  <TableRow key={r.student.id}>
                    <TableCell className="tabular-nums">{i + 1}</TableCell>
                    <TableCell dir="rtl" className="whitespace-nowrap">{r.student.name}{r.no_enrollment ? <span className="ms-2 text-xs text-destructive">{t("noEnrollment")}</span> : null}</TableCell>
                    <TableCell dir="rtl" className="text-xs">{r.decision}</TableCell>
                    <TableCell className="tabular-nums">{r.pct === null ? "—" : fmtPct(r.pct, 1)}</TableCell>
                    <TableCell><ResultChip label={t(`kind_${r.kind}`)} tone={KIND_TONE[r.kind]} /></TableCell>
                    <TableCell dir="rtl">{r.enrollment_label ?? "—"}</TableCell>
                    <TableCell>
                      {r.kind === "promote" || r.kind === "repeat" ? (
                        <Select value={chosen || undefined} onValueChange={(v) => setNext((n) => ({ ...n, [r.student.id]: v }))} disabled={r.no_enrollment || held[r.student.id]}>
                          <SelectTrigger className={needsTrack ? "w-44 border-warning" : "w-44"}><SelectValue placeholder={t("pickTrack")} /></SelectTrigger>
                          <SelectContent>{data.next_grade_options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Checkbox checked={held[r.student.id] ?? false} disabled={r.no_enrollment} onCheckedChange={(v) => setHeld((h) => ({ ...h, [r.student.id]: v === true }))} aria-label={t("hold")} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={apply} disabled={busy}><CheckCircle2 className="size-4" />{t("rolloverApply")}</Button>
      </div>
      {result ? (
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm">
            <p>{t("rolloverResult", { planned: result.planned, held: result.held })}</p>
            {result.missing_next_grade.length ? <p className="text-warning" dir="rtl">{t("missingNextGrade")}: {result.missing_next_grade.join("، ")}</p> : null}
            {result.no_enrollment.length ? <p className="text-destructive" dir="rtl">{t("noEnrollment")}: {result.no_enrollment.join("، ")}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
