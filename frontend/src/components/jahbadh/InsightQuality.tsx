"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangle, BadgeCheck, Plus, Save, Send, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { jgInsightApi, openInsightPdf, type JgCertificates, type JgEndOfYear } from "@/lib/api/jahbadh-insight"
import { certificateText, fmtPct, type JgCertificateKind, type JgProgressStatus } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { ResultChip, Tile, useJgContext, useSectionResource, type JgBase } from "./shared"
import { InsightPage, Loading, PdfButton, useOverview } from "./insight-shared"

const today = () => new Date().toISOString().slice(0, 10)

/** «مدقق الإدخال» (B6-37): errors block publishing report cards; each issue links to the grid cell. */
export function EntryAudit({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insEntryAudit")} subtitle={t("insEntryAuditSubtitle")}>
      {(sectionId, campusId) => <EntryAuditBody base={base} sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function EntryAuditBody({ base, sectionId, campusId }: { base: JgBase; sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [level, setLevel] = useState<"all" | "error" | "warning" | "roster">("all")
  const data = useSectionResource(["jg-entry-audit", sectionId, campusId], () => jgInsightApi.entryAudit(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const issues = d.issues.filter((i) => level === "all" || i.level === level)
  const tone = { error: "destructive", warning: "warning", roster: "muted" } as const
  return (
    <div className="space-y-4">
      {d.errors > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>{t("insAuditBlocked", { n: d.errors })}</p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p>{t("insAuditClean")}</p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Tile label={t("insErrors")} value={d.errors} tone="destructive" />
        <Tile label={t("insWarnings")} value={d.warnings} tone="warning" />
        <Tile label={t("insRosterNotes")} value={d.roster} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "error", "warning", "roster"] as const).map((l) => (
          <Button key={l} size="sm" variant={level === l ? "default" : "outline"} onClick={() => setLevel(l)}>{t(`insLevel_${l}`)}</Button>
        ))}
        <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.audit(sectionId, campusId)} />
      </div>
      {!issues.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("insNothingToShow")}</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("insLevel")}</TableHead>
                <TableHead>{t("insIssue")}</TableHead>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("subject")}</TableHead>
                <TableHead>{t("insDetail")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((i, k) => {
                const stageName = i.stage ? d.stage_names[i.stage - 1] ?? String(i.stage) : null
                const grid = i.subject_id
                  ? `${base}/grid?section=${sectionId}&subject=${i.subject_id}${i.stage ? `&stage=${i.stage}` : ""}&student=${i.student_id}${i.component_id ? `&component=${i.component_id}` : ""}`
                  : null
                return (
                  <TableRow key={`${i.kind}-${i.student_id}-${i.subject_id ?? ""}-${i.stage ?? ""}-${k}`}>
                    <TableCell><ResultChip label={t(`insLevel_${i.level}`)} tone={tone[i.level]} /></TableCell>
                    <TableCell className="text-sm" dir="auto">{i.label}</TableCell>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.subject ?? "—"}{stageName ? ` · ${stageName}` : ""}</TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground" dir="auto">{i.detail ?? ""}</TableCell>
                    <TableCell>{grid ? <Button size="sm" variant="outline" asChild><Link href={grid}>{t("insOpenCell")}</Link></Button> : null}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

/** «سجل الاعتماد» (B6-38): approval seal = snapshot of the marks, then a diff of what changed since. */
export function Approval({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insApproval")} subtitle={t("insApprovalSubtitle")}>
      {(sectionId, campusId, isAdmin) => <ApprovalBody sectionId={sectionId} campusId={campusId} isAdmin={isAdmin} />}
    </InsightPage>
  )
}

const short = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v))

function ApprovalBody({ sectionId, campusId, isAdmin }: { sectionId: string; campusId: string | null; isAdmin: boolean }) {
  const t = useTranslations("grades")
  const { stages } = useOverview(sectionId, campusId)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const data = useSectionResource(["jg-approval", sectionId, campusId], () => jgInsightApi.approval(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const approve = async () => {
    setBusy(true)
    const res = await jgInsightApi.approve(sectionId, note || null, campusId)
    setBusy(false)
    if (!res.success) return toast.error(res.code === "audit_errors" ? t("insApproveBlocked") : res.error)
    toast.success(t("insApproved"))
    setNote("")
    data.mutate(res.data, false)
  }
  const stageLabel = (s: number | "round2" | "cells") => (s === "round2" ? t("insRound2") : s === "cells" ? t("insCells") : stages.find((x) => x.stage === s)?.name ?? String(s))
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <ResultChip label={d.status_label ?? t(`insApprovalStatus_${d.status}`)} tone={d.status === "matches" ? "success" : d.status === "changed" ? "warning" : "muted"} />
          {d.approved ? <span className="text-sm text-muted-foreground">{t("insApprovedOn", { date: new Date(d.approved.at).toLocaleString() })}{d.approved.note ? ` — ${d.approved.note}` : ""}</span> : null}
          <div className="ms-auto flex flex-wrap gap-2">
            <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.approval(sectionId, campusId)} />
          </div>
        </CardContent>
      </Card>
      {isAdmin ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insApproveNow")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1 space-y-1">
              <Label>{t("insApprovalNote")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button onClick={approve} disabled={busy}><ShieldCheck className="size-4" />{t("insApprove")}</Button>
            <p className="w-full text-xs text-muted-foreground">{t("insApproveHint")}</p>
          </CardContent>
        </Card>
      ) : null}
      {d.changes.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insChangesSince")} ({d.changes.length})</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("subject")}</TableHead>
                <TableHead>{t("insStage")}</TableHead>
                <TableHead>{t("insApprovedValue")}</TableHead>
                <TableHead>{t("insCurrentValue")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.changes.map((c, k) => (
                <TableRow key={`${c.student_id}-${c.subject_id}-${c.stage}-${k}`}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.subject}</TableCell>
                  <TableCell>{stageLabel(c.stage)}</TableCell>
                  <TableCell className="tabular-nums">{short(c.approved)}</TableCell>
                  <TableCell className="tabular-nums">{short(c.current)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : d.approved ? <p className="text-sm text-muted-foreground">{t("insNoChangesSince")}</p> : null}
      {d.log.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insChangeLog")}</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("insWhen")}</TableHead>
                <TableHead>{t("insBy")}</TableHead>
                <TableHead>{t("insAction")}</TableHead>
                <TableHead>{t("insBefore")}</TableHead>
                <TableHead>{t("insAfter")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.log.map((l, k) => (
                <TableRow key={`${l.created_at}-${k}`}>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{l.actor_role ?? "—"}</TableCell>
                  <TableCell className="text-sm">{l.action}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs" dir="ltr">{short(l.before)}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs" dir="ltr">{short(l.after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </div>
  )
}

/** «التحقق من صحيفة» (B6-39): issued codes, issue new ones, and check a code against the current marks. */
export function Verification({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insVerification")} subtitle={t("insVerificationSubtitle")}>
      {(sectionId, campusId) => <VerificationBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function VerificationBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const { stages } = useOverview(sectionId, campusId)
  const [scope, setScope] = useState("final")
  const [code, setCode] = useState("")
  const [number, setNumber] = useState("")
  const [checked, setChecked] = useState<{ status: string; summary?: Record<string, unknown> } | null>(null)
  const data = useSectionResource(["jg-verification", sectionId, campusId], () => jgInsightApi.verificationArchive(sectionId, campusId))
  const d = data.data
  const issue = async () => {
    const res = await jgInsightApi.issueVerificationCodes(sectionId, scope, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("insCodesIssued", { n: Object.keys(res.data?.codes ?? {}).length }))
    data.mutate()
  }
  const check = async () => {
    const res = await jgInsightApi.checkVerificationCode(sectionId, code.trim(), number.trim() || null, campusId)
    if (!res.success) return toast.error(res.error)
    setChecked(res.data!)
  }
  const copy = (url: string) => navigator.clipboard?.writeText(url).then(() => toast.success(t("insCopied"))).catch(() => undefined)
  const statusTone = (s: string) => (s === "matches" ? "success" : s === "outdated" ? "warning" : "destructive")
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insIssueCodes")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.stage} value={`stage${s.stage}`}>{s.name}</SelectItem>)}
                <SelectItem value="final">{t("finalResult")}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={issue}><Send className="size-4" />{t("insIssue")}</Button>
            <PdfButton label={t("insArchivePdf")} onClick={() => openInsightPdf.verification(sectionId, campusId)} />
            <p className="w-full text-xs text-muted-foreground">{t("insVerificationHint")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insCheckCode")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label>{t("insCode")}</Label>
                <Input dir="ltr" className="w-44" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t("insStudentNumber")}</Label>
                <Input dir="ltr" className="w-36" value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <Button variant="outline" onClick={check} disabled={!code.trim()}>{t("insCheck")}</Button>
            </div>
            {checked ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <ResultChip label={t(`insVerifyStatus_${checked.status}`)} tone={statusTone(checked.status)} />
                {checked.summary?.name ? <span dir="auto">{String(checked.summary.name)}</span> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : !d.codes.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("insNoCodes")}</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("insCode")}</TableHead>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("scope")}</TableHead>
                <TableHead>{t("insDecision")}</TableHead>
                <TableHead>{t("insIssuedAt")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.codes.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="font-mono tabular-nums" dir="ltr">{c.code}</TableCell>
                  <TableCell className="font-medium" dir="auto">{String(c.summary?.name ?? c.student_id)}</TableCell>
                  <TableCell>{c.scope}</TableCell>
                  <TableCell className="text-sm" dir="auto">{String(c.summary?.decision ?? "—")}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{new Date(c.issued_at).toLocaleDateString()}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => copy(c.url)}>{t("insCopyLink")}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

const KINDS: JgCertificateKind[] = ["excellence", "top3", "improved", "attendance", "stars"]

/** «شهادات التقدير» (B6-40): five types, one landscape A4 per eligible student. */
export function Certificates({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insCertificates")} subtitle={t("insCertificatesSubtitle")}>
      {(sectionId, campusId) => <CertificatesBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function CertificatesBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const { stages } = useOverview(sectionId, campusId)
  const [scope, setScope] = useState<string>("final")
  const [kind, setKind] = useState<JgCertificateKind>("excellence")
  const scopeValue: number | "final" = scope === "final" ? "final" : Number(scope)
  const data = useSectionResource(["jg-certificates", sectionId, campusId, scope], () => jgInsightApi.certificates(sectionId, scopeValue, campusId))
  const d: JgCertificates | undefined = data.data
  const rows = d?.certificates[kind] ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {stages.map((s) => <SelectItem key={s.stage} value={String(s.stage)}>{s.name}</SelectItem>)}
            <SelectItem value="final">{t("finalResult")}</SelectItem>
          </SelectContent>
        </Select>
        {KINDS.map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
            {t(`insCert_${k}`)}{d ? ` (${d.certificates[k].length})` : ""}
          </Button>
        ))}
        <PdfButton label={t("printPdf")} disabled={!rows.length} onClick={() => openInsightPdf.certificates(sectionId, kind, scopeValue, campusId)} />
      </div>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : !rows.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("insNoCertificates")}</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("insPct")}</TableHead>
                <TableHead>{t("rank")}</TableHead>
                <TableHead>{t("insDetail")}</TableHead>
                <TableHead>{t("insCertificateText")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.kind}-${r.student_id}`}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="tabular-nums">{fmtPct(r.pct, 1) || "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.rank ?? "—"}</TableCell>
                  <TableCell className="text-sm" dir="auto">{r.detail}</TableCell>
                  <TableCell className="max-w-md text-sm" dir="auto">{certificateText(kind, r.gender, d.basic, d.scope_name)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

const PROGRESS_TONE: Record<JgProgressStatus, "success" | "warning" | "destructive" | "muted"> = {
  complete: "success", in_progress: "warning", not_started: "muted", late: "destructive",
}

/** «متابعة الرصد» (B6-46): who has entered what, deadlines per stage and reminders to the teachers. */
export function EntryProgress({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insEntryProgress")} subtitle={t("insEntryProgressSubtitle")}>
      {(sectionId, campusId, isAdmin) => <EntryProgressBody sectionId={sectionId} campusId={campusId} isAdmin={isAdmin} />}
    </InsightPage>
  )
}

function EntryProgressBody({ sectionId, campusId, isAdmin }: { sectionId: string; campusId: string | null; isAdmin: boolean }) {
  const t = useTranslations("grades")
  const { stages } = useOverview(sectionId, campusId)
  const [dl, setDl] = useState<Record<number, string>>({})
  const [all, setAll] = useState(false)
  const data = useSectionResource(["jg-entry-progress", sectionId, campusId], () => jgInsightApi.entryProgress(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const deadline = (stage: number) => dl[stage] ?? d.deadlines[stage] ?? ""
  const saveDeadlines = async () => {
    const body: Record<number, string | null> = {}
    for (const s of stages) body[s.stage] = deadline(s.stage) || null
    const res = await jgInsightApi.saveStageDeadlines(sectionId, body, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setDl({})
    data.mutate()
  }
  const remind = async () => {
    const res = await jgInsightApi.sendEntryReminders(sectionId, all, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("insRemindersSent", { n: res.data?.sent ?? 0 }))
    data.mutate()
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label={t("insCurrentStageProgress")} value={d.current_pct === null ? "—" : `${d.current_pct}%`} tone={d.current_pct !== null && d.current_pct >= 100 ? "success" : "warning"} />
        <Tile label={t("insLateRows")} value={d.rows.filter((r) => r.status === "late").length} tone="destructive" />
        <Tile label={t("insCompleteRows")} value={d.rows.filter((r) => r.status === "complete").length} tone="success" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.entryProgress(sectionId, campusId)} />
      </div>
      {isAdmin ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("insDeadlines")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {stages.map((s) => (
                <div key={s.stage} className="flex items-center gap-2">
                  <Label className="w-40 shrink-0">{s.name}</Label>
                  <Input type="date" value={deadline(s.stage)} onChange={(e) => setDl((x) => ({ ...x, [s.stage]: e.target.value }))} />
                </div>
              ))}
              <Button variant="outline" onClick={saveDeadlines}><Save className="size-4" />{t("save")}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("insReminders")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={all} onCheckedChange={setAll} id="remind-all" />
                <Label htmlFor="remind-all">{t("insRemindAll")}</Label>
              </div>
              <Button onClick={remind}><Send className="size-4" />{t("insSendReminders")}</Button>
              <p className="text-xs text-muted-foreground">{t("insRemindHint")}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("subject")}</TableHead>
              <TableHead>{t("insStage")}</TableHead>
              <TableHead>{t("insEntered")}</TableHead>
              <TableHead>{t("insStatus")}</TableHead>
              <TableHead>{t("insDeadline")}</TableHead>
              <TableHead>{t("insTeacher")}</TableHead>
              <TableHead>{t("insReminder")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.rows.map((r) => (
              <TableRow key={`${r.subject_id}-${r.stage}`}>
                <TableCell className="font-medium">{r.subject}</TableCell>
                <TableCell>{r.stage_name}</TableCell>
                <TableCell className="tabular-nums">{`${r.done} / ${r.required} (${r.pct}%)`}</TableCell>
                <TableCell><ResultChip label={r.status_label} tone={PROGRESS_TONE[r.status]} /></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{r.deadline ?? "—"}</TableCell>
                <TableCell>{r.teacher ?? "—"}</TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground" dir="auto">{r.reminder ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

const MEDAL: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" }

/** «نقاط التميز» (B6-48): points per category, the leaderboard, stars and the log. */
export function Excellence({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insExcellence")} subtitle={t("insExcellenceSubtitle")}>
      {(sectionId, campusId) => <ExcellenceBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function ExcellenceBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [period, setPeriod] = useState<{ from?: string; to?: string }>({})
  const [student, setStudent] = useState("")
  const [category, setCategory] = useState("0")
  const [points, setPoints] = useState("1")
  const [note, setNote] = useState("")
  const [date, setDate] = useState(today())
  const data = useSectionResource(["jg-excellence", sectionId, campusId, period.from, period.to], () => jgInsightApi.excellence(sectionId, period, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const add = async () => {
    const n = Number(points)
    if (!student || !Number.isFinite(n) || n === 0) return toast.error(t("insPointsInvalid"))
    const res = await jgInsightApi.addExcellencePoints(sectionId, { student_id: student, category: Number(category), points: n, note: note || undefined, awarded_on: date }, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setNote("")
    data.mutate()
  }
  const remove = async (id: string) => {
    const res = await jgInsightApi.deleteExcellencePoints(sectionId, id, campusId)
    if (!res.success) return toast.error(res.error)
    data.mutate()
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("insAddPoints")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1 lg:col-span-2">
            <Label>{t("student")}</Label>
            <Select value={student || undefined} onValueChange={setStudent}>
              <SelectTrigger><SelectValue placeholder={t("insChooseStudent")} /></SelectTrigger>
              <SelectContent>{d.rows.map((r) => <SelectItem key={r.student_id} value={r.student_id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("insCategory")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{d.categories.map((c, i) => <SelectItem key={i} value={String(i)}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("insPoints")}</Label>
            <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("insDate")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-5">
            <Label>{t("insNote")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={add}><Plus className="size-4" />{t("insAdd")}</Button>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-6">{t("insPointsHint")}</p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label>{t("insFrom")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label>{t("insTo")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button variant="outline" onClick={() => setPeriod({ from: from || undefined, to: to || undefined })}>{t("insApply")}</Button>
        <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.excellence(sectionId, period, campusId)} />
      </div>
      {d.stars.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {d.stars.map((s) => (
            <Card key={s.category}>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs text-muted-foreground">{s.category}</p>
                <p className="font-semibold" dir="auto">⭐ {s.students.join("، ")}</p>
                <p className="text-sm tabular-nums">{s.points}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("rank")}</TableHead>
              <TableHead>{t("student")}</TableHead>
              {d.categories.map((c, i) => <TableHead key={i} className="text-center">{c}</TableHead>)}
              <TableHead className="text-center">{t("total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.rows.map((r) => (
              <TableRow key={r.student_id}>
                <TableCell className="tabular-nums">{r.medal ? MEDAL[r.medal] : r.rank}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                {r.per_category.map((p, i) => <TableCell key={i} className="text-center tabular-nums">{p}</TableCell>)}
                <TableCell className="text-center font-bold tabular-nums">{r.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("insPointsLog")}</CardTitle></CardHeader>
        {!d.log.length ? <CardContent><p className="text-sm text-muted-foreground">{t("insNoPoints")}</p></CardContent> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("insDate")}</TableHead>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("insCategory")}</TableHead>
                <TableHead>{t("insPoints")}</TableHead>
                <TableHead>{t("insNote")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.log.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-sm">{l.awarded_on}</TableCell>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>{l.category_name}</TableCell>
                  <TableCell className={cn("tabular-nums", l.points < 0 && "text-destructive")}>{l.points > 0 ? `+${l.points}` : l.points}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="auto">{l.note ?? ""}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" aria-label={t("insDelete")} onClick={() => remove(l.id)}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

/** «التقرير الختامي» (B6-49): the end-of-year report to the education office. */
export function EndOfYear({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insEndOfYear")} subtitle={t("insEndOfYearSubtitle")}>
      {(sectionId, campusId, isAdmin) => <EndOfYearBody sectionId={sectionId} campusId={campusId} isAdmin={isAdmin} />}
    </InsightPage>
  )
}

function EndOfYearBody({ sectionId, campusId, isAdmin }: { sectionId: string; campusId: string | null; isAdmin: boolean }) {
  const t = useTranslations("grades")
  const data = useSectionResource(["jg-eoy", sectionId, campusId], () => jgInsightApi.endOfYear(sectionId, campusId))
  const d: JgEndOfYear | undefined = data.data
  const [rows, setRows] = useState<{ k: string; v: string }[] | null>(null)
  const [free, setFree] = useState<string | null>(null)
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const manualRows = rows ?? Object.entries(d.manual).filter(([k]) => k !== "free_line").map(([k, v]) => ({ k, v: String(v) }))
  const freeLine = free ?? String(d.manual.free_line ?? "")
  const save = async () => {
    const manual: Record<string, number | string> = {}
    for (const r of manualRows) {
      const key = r.k.trim()
      if (!key || key === "free_line") continue
      manual[key] = r.v.trim() !== "" && Number.isFinite(Number(r.v)) ? Number(r.v) : r.v
    }
    if (freeLine.trim()) manual.free_line = freeLine.trim()
    const res = await jgInsightApi.saveEndOfYear(sectionId, manual, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setRows(null)
    setFree(null)
    data.mutate(res.data, false)
  }
  const split = (s: { m: number; f: number; total: number }) => `${s.total} (${s.m}/${s.f})`
  const totalRows: [string, { m: number; f: number; total: number }][] = [
    [t("enrolled"), d.totals.enrolled], [t("insExamined"), d.totals.examined], [t("passed"), d.totals.passed],
    [t("round2"), d.totals.round2], [t("failed"), d.totals.failed], [t("insUndecided"), d.totals.undecided],
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.endOfYear(sectionId, campusId)} />
        {d.approval ? <ResultChip label={t("insApprovedOn", { date: new Date(d.approval.at).toLocaleDateString() })} tone="success" /> : <ResultChip label={t("insNotApprovedYet")} tone="muted" />}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t("insAverageAll")} value={d.averages.all === null ? "—" : fmtPct(d.averages.all, 1)} />
        <Tile label={t("boys")} value={d.averages.boys === null ? "—" : fmtPct(d.averages.boys, 1)} />
        <Tile label={t("girls")} value={d.averages.girls === null ? "—" : fmtPct(d.averages.girls, 1)} />
        <Tile label={t("insAttendanceRate")} value={d.attendance_rate === null ? "—" : fmtPct(d.attendance_rate, 1)} tone="success" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t("insPassRate")} value={d.rates.passed === null ? "—" : fmtPct(d.rates.passed, 1)} tone="success" />
        <Tile label={t("insRound2Rate")} value={d.rates.round2 === null ? "—" : fmtPct(d.rates.round2, 1)} tone="warning" />
        <Tile label={t("insFailRate")} value={d.rates.failed === null ? "—" : fmtPct(d.rates.failed, 1)} tone="destructive" />
        <Tile label={t("insUndecidedRate")} value={d.rates.undecided === null ? "—" : fmtPct(d.rates.undecided, 1)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("insTotalsByGender")}</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">{t("splitLegend")}</p>
          <Table>
            <TableBody>
              {totalRows.map(([label, s]) => (
                <TableRow key={label}><TableCell className="font-medium">{label}</TableCell><TableCell className="tabular-nums">{split(s)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("subjects")}</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("subject")}</TableHead>
              <TableHead>{t("insAverage")}</TableHead>
              <TableHead>{t("highest")}</TableHead>
              <TableHead>{t("lowest")}</TableHead>
              <TableHead>{t("passRate")}</TableHead>
              <TableHead>{t("insExcellent")}</TableHead>
              <TableHead>{t("insLevel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.subjects.map((s) => (
              <TableRow key={s.subject_id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="tabular-nums">{s.average === null ? "—" : fmtPct(s.average, 1)}</TableCell>
                <TableCell className="tabular-nums">{s.highest === null ? "—" : fmtPct(s.highest, 0)}</TableCell>
                <TableCell className="tabular-nums">{s.lowest === null ? "—" : fmtPct(s.lowest, 0)}</TableCell>
                <TableCell className="tabular-nums">{s.pass_rate === null ? "—" : fmtPct(s.pass_rate, 0)}</TableCell>
                <TableCell className="tabular-nums">{s.excellent}</TableCell>
                <TableCell>{s.band ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insTop5")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {d.top5.map((s, i) => <p key={i} dir="auto">{`${s.rank ?? i + 1}. ${s.name} — ${fmtPct(s.pct, 1) || "—"}`}</p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insMostImproved")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {d.most_improved.length ? d.most_improved.map((s, i) => <p key={i} dir="auto">{`${s.name} — ${s.gain}`}</p>) : <p className="text-muted-foreground">{t("insNothingToShow")}</p>}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("insRecommendations")}</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {d.recommendations.map((r, i) => <p key={i} dir="auto">• {r}</p>)}
        </CardContent>
      </Card>
      {isAdmin ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insLastYear")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("insLastYearHint")}</p>
            {manualRows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input value={r.k} placeholder={t("insLabel")} onChange={(e) => setRows(manualRows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
                <Input className="w-40" value={r.v} placeholder={t("insValue")} onChange={(e) => setRows(manualRows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" aria-label={t("insDelete")} onClick={() => setRows(manualRows.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows([...manualRows, { k: "", v: "" }])}><Plus className="size-4" />{t("insAddRow")}</Button>
            <div className="space-y-1">
              <Label>{t("insFreeLine")}</Label>
              <Textarea rows={2} value={freeLine} onChange={(e) => setFree(e.target.value)} />
            </div>
            <Button onClick={save}><Save className="size-4" />{t("save")}</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
