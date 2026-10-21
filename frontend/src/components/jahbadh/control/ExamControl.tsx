"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRight, Plus, ShieldCheck, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jcApi, type JcStatus } from "@/lib/api/jahbadh-control"
import { JgBlocked, useJgContext } from "../shared"
import { AlertsTab, AuditTab, PrintsTab } from "./Outcome"
import { ExamDayTab } from "./ExamDay"
import { EntryTab, QualityTab } from "./Grading"
import { OverviewTab } from "./Overview"
import { CommitteesTab, PlanningTab, SetupTab, StudentsTab } from "./Prepare"
import { ResultsTab } from "./Results"
import { EmptyCard, JC_STATUSES, StatusChip, jcRun, jcTabs, useJc, type JcBase, type TabKey, type TabProps } from "./shared"

/** Exam control («كنترول جهبذ»): the session list, or one session's workspace (?session=…&tab=…). */
export function ExamControl({ base }: { base: JcBase }) {
  const params = useSearchParams()
  const sessionId = params.get("session")
  return sessionId ? <Workspace base={base} sessionId={sessionId} /> : <SessionList base={base} />
}

function SessionList({ base }: { base: JcBase }) {
  const t = useTranslations("examControl")
  const { isAdmin, campusId } = useJgContext()
  const router = useRouter()
  const list = useJc(["jc-sessions", campusId], () => jcApi.sessions(campusId))
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [stage, setStage] = useState("1")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    const res = await jcRun(jcApi.createSession({ name, stage: Number(stage), issue_date: date, campus_id: campusId }), t("created"))
    setBusy(false)
    if (res) router.push(`${base}?session=${res.session.id}&tab=setup`)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            {t("newSession")}
          </Button>
        ) : null}
      </div>
      {list.error ? (
        <JgBlocked code={(list.error as { code?: string }).code} message={list.error.message} isAdmin={isAdmin} />
      ) : !list.data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !list.data.length ? (
        <EmptyCard text={isAdmin ? t("noSessionsAdmin") : t("noSessionsMember")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((s) => (
            <Link key={s.id} href={`${base}?session=${s.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span>{s.name}</span>
                    <StatusChip status={s.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>{t(`round_${s.round}`)} · {t("stageN", { n: s.stage })}</p>
                  <p dir="ltr" className="text-start">{s.issue_date}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newSession")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("sessionName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("sessionNameHint")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("stage")}</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{t("stageN", { n })}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("issueDate")}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button disabled={!name.trim() || busy} onClick={create}>{t("create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Workspace({ base, sessionId }: { base: JcBase; sessionId: string }) {
  const t = useTranslations("examControl")
  const { isAdmin } = useJgContext()
  const router = useRouter()
  const params = useSearchParams()
  const ov = useJc(["jc-overview", sessionId], () => jcApi.overview(sessionId))
  const o = ov.data
  const tabs = o ? jcTabs(o) : []
  const requested = params.get("tab") as TabKey | null
  const tab = requested && tabs.includes(requested) ? requested : "overview"
  const setTab = (next: string) => router.replace(`${base}?session=${sessionId}&tab=${next}`)
  const refresh = () => void ov.mutate()

  const setStatus = async (status: JcStatus) => {
    const res = await jcRun(jcApi.updateSession(sessionId, { status }), t("saved"))
    if (res) ov.mutate(res, false)
  }
  const remove = async () => {
    if (!window.confirm(t("confirmDeleteSession"))) return
    if (await jcRun(jcApi.deleteSession(sessionId), t("deleted"))) router.push(base)
  }

  if (ov.error) {
    return (
      <div className="p-4 md:p-6">
        <JgBlocked code={(ov.error as { code?: string }).code} message={ov.error.message} isAdmin={isAdmin} />
      </div>
    )
  }
  if (!o) return <div className="space-y-3 p-4 md:p-6"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>
  const props: TabProps = { sessionId, overview: o, refresh }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={base} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
              {o.session.name}
              <StatusChip status={o.session.status} />
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(`round_${o.session.round}`)} · {t("stageN", { n: o.session.stage })} · {t("sessionCode")} <span dir="ltr">{o.session.session_code}</span>
              {o.rights.unmasked ? <> · <ShieldCheck className="inline size-4 text-success" /> {t("unmaskedShort")}</> : null}
            </p>
          </div>
        </div>
        {o.rights.manage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={o.session.status} onValueChange={(v) => setStatus(v as JcStatus)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {JC_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status_${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            {o.rights.chief ? (
              <Button variant="ghost" size="icon" onClick={remove} aria-label={t("deleteSession")}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          {tabs.map((k) => <TabsTrigger key={k} value={k}>{t(`tab_${k}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview"><OverviewTab {...props} onOpen={setTab} /></TabsContent>
        {tab === "setup" ? <TabsContent value="setup"><SetupTab {...props} /></TabsContent> : null}
        {tab === "students" ? <TabsContent value="students"><StudentsTab {...props} /></TabsContent> : null}
        {tab === "committees" ? <TabsContent value="committees"><CommitteesTab {...props} /></TabsContent> : null}
        {tab === "planning" ? <TabsContent value="planning"><PlanningTab {...props} /></TabsContent> : null}
        {tab === "alerts" ? <TabsContent value="alerts"><AlertsTab {...props} /></TabsContent> : null}
        {tab === "prints" ? <TabsContent value="prints"><PrintsTab {...props} /></TabsContent> : null}
        {tab === "examday" ? <TabsContent value="examday"><ExamDayTab {...props} /></TabsContent> : null}
        {tab === "entry" ? <TabsContent value="entry"><EntryTab {...props} /></TabsContent> : null}
        {tab === "quality" ? <TabsContent value="quality"><QualityTab {...props} /></TabsContent> : null}
        {tab === "results" ? <TabsContent value="results"><ResultsTab {...props} /></TabsContent> : null}
        {tab === "audit" ? <TabsContent value="audit"><AuditTab {...props} /></TabsContent> : null}
      </Tabs>
    </div>
  )
}
