"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, CheckCircle2, Info, Lock } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { jcApi, type JcAlert, type JcDoc } from "@/lib/api/jahbadh-control"
import { cn } from "@/lib/utils"
import { pickDefaultDay } from "./ExamDay"
import { DocButton, EmptyCard, Note, useJc, type TabProps } from "./shared"

// ---- alerts (C6.4) ------------------------------------------------------------------------------------

const PHASES: JcAlert["phase"][] = ["before", "examday", "after"]

export function AlertsTab({ sessionId }: TabProps) {
  const t = useTranslations("examControl")
  const alerts = useJc(["jc-alerts", sessionId], () => jcApi.alerts(sessionId))
  if (alerts.error) return <Note tone="destructive">{alerts.error.message}</Note>
  if (!alerts.data) return <Skeleton className="h-64" />
  const errors = alerts.data.filter((a) => a.status === "error").length
  return (
    <div className="space-y-4">
      <Note tone={errors ? "destructive" : "success"}>{errors ? t("alertsErrors", { n: errors }) : t("alertsClear")}</Note>
      {PHASES.map((phase) => (
        <Card key={phase}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t(`phase_${phase}`)}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {alerts.data!.filter((a) => a.phase === phase).map((a) => <AlertRow key={a.key} alert={a} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function AlertRow({ alert: a }: { alert: JcAlert }) {
  const t = useTranslations("examControl")
  const [open, setOpen] = useState(false)
  const Icon = a.status === "ok" ? CheckCircle2 : a.status === "info" ? Info : AlertTriangle
  return (
    <div className="rounded-md px-2 py-1.5 hover:bg-muted/50">
      <button type="button" className="flex w-full items-center gap-2 text-start" onClick={() => setOpen((v) => !v)} disabled={!a.details?.length}>
        <Icon className={cn("size-4 shrink-0", a.status === "ok" ? "text-success" : a.status === "info" ? "text-primary" : "text-destructive")} />
        <span className="flex-1 text-sm">{t(`alert_${a.key}`)}</span>
        <span className={cn("rounded px-1.5 text-xs font-semibold tabular-nums", a.status === "error" ? "bg-destructive/15 text-destructive" : "bg-muted")}>{a.count}</span>
      </button>
      {open && a.details?.length ? <p className="ms-6 mt-1 text-xs text-muted-foreground">{a.details.join("، ")}</p> : null}
    </div>
  )
}

// ---- prints (C8) --------------------------------------------------------------------------------------

const DOC_GROUPS: { key: string; docs: JcDoc[] }[] = [
  { key: "lists", docs: ["general_list", "secret_lists", "committee_mirror", "seating_map", "student_cards", "booklet_covers"] },
  { key: "planning", docs: ["timetable", "invigilation"] },
  { key: "examday", docs: ["attendance_sheet", "envelope_mirror", "delivery_sheet", "minutes_open", "minutes_absence", "minutes_seal", "minutes_incident"] },
  { key: "outcome", docs: ["results", "honor_board", "certificates"] },
]
const CONFIDENTIAL: JcDoc[] = ["general_list", "secret_lists", "booklet_covers"]
const NEEDS_DAY: JcDoc[] = ["attendance_sheet", "minutes_open", "minutes_absence", "minutes_seal", "minutes_incident"]
const PER_COMMITTEE: JcDoc[] = ["committee_mirror", "seating_map", "student_cards", "booklet_covers", "attendance_sheet", "minutes_open", "minutes_absence", "minutes_seal", "minutes_incident", "secret_lists"]
const NEEDS_UNMASK: JcDoc[] = ["results", "honor_board", "certificates"]
const ALL = "__all"

export function PrintsTab({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const committees = useJc(["jc-committees", sessionId], () => jcApi.committees(sessionId))
  const days = useJc(["jc-days", sessionId], () => jcApi.schedule(sessionId))
  const [committee, setCommittee] = useState(ALL)
  const [dayId, setDayId] = useState<string | null>(null)
  const day = dayId ?? (days.data ? pickDefaultDay(days.data) : null)
  const r = o.rights
  const allowed = (doc: JcDoc) => (CONFIDENTIAL.includes(doc) ? r.secret : r.manage || r.examday) && (!NEEDS_UNMASK.includes(doc) || r.unmasked)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={committee} onValueChange={setCommittee}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allCommittees")}</SelectItem>
            {(committees.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {days.data?.length ? (
          <Select value={day ?? undefined} onValueChange={setDayId}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>{days.data.map((d) => <SelectItem key={d.id} value={d.id}>{d.exam_date} — {d.subject_name}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
      </div>
      <Note>{t("printsHint")}</Note>
      {DOC_GROUPS.map((g) => {
        const docs = g.docs.filter(allowed)
        if (!docs.length) return null
        return (
          <Card key={g.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t(`docGroup_${g.key}`)}</CardTitle>
              {g.key === "examday" && !day ? <CardDescription>{t("noDays")}</CardDescription> : null}
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {docs.map((doc) => {
                const disabled = NEEDS_DAY.includes(doc) && !day
                return (
                  <div key={doc} className={cn("flex items-center justify-between gap-2 rounded-md border p-2", disabled && "opacity-50")}>
                    <span className="text-sm">
                      {CONFIDENTIAL.includes(doc) ? <Lock className="me-1 inline size-3 text-warning" /> : null}
                      {t(`doc_${doc}`)}
                      <span className="block text-xs text-muted-foreground">{t(`docHint_${doc}`)}</span>
                    </span>
                    {disabled ? null : (
                      <DocButton
                        sessionId={sessionId}
                        doc={doc}
                        committeeId={PER_COMMITTEE.includes(doc) && committee !== ALL ? committee : null}
                        dayId={day}
                        label={t("print")}
                      />
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ---- audit log ----------------------------------------------------------------------------------------

export function AuditTab({ sessionId }: TabProps) {
  const t = useTranslations("examControl")
  const log = useJc(["jc-audit", sessionId], () => jcApi.audit(sessionId))
  if (!log.data) return <Skeleton className="h-64" />
  if (!log.data.length) return <EmptyCard text={t("noAudit")} />
  return (
    <div className="space-y-3">
      <Note>{t("auditHint")}</Note>
      <Card>
        <CardContent className="max-h-[70vh] overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>{t("time")}</TableHead>
                <TableHead>{t("actor")}</TableHead>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("details")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell dir="ltr" className="whitespace-nowrap text-start text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{e.actor_name || "—"}<span className="block text-xs text-muted-foreground">{e.actor_role}</span></TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{e.action}</TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs" dir="ltr" title={e.after ? JSON.stringify(e.after) : ""}>{e.after ? JSON.stringify(e.after) : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
