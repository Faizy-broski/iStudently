"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeftRight, MessageCircle, Repeat2, Send, Trophy, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jcApi, type JcExport } from "@/lib/api/jahbadh-control"
import { cn } from "@/lib/utils"
import { Tile } from "../shared"
import { toast } from "sonner"
import { DocButton, EmptyCard, Note, jcRun, pct, useJc, type TabProps } from "./shared"

export function ResultsTab(props: TabProps) {
  const t = useTranslations("examControl")
  const manage = props.overview.rights.manage
  const chief = props.overview.rights.chief
  // Before unmasking only the honor board (names hidden) is available; scores need unmasking.
  if (!props.overview.rights.unmasked) {
    return (
      <div className="space-y-3">
        <Note tone="warning">{t("resultsAfterUnmask")}</Note>
        <HonorBoard {...props} />
      </div>
    )
  }
  return (
    <Tabs defaultValue="results">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="results">{t("results")}</TabsTrigger>
        <TabsTrigger value="honor">{t("honorBoard")}</TabsTrigger>
        <TabsTrigger value="second">{t("secondRound")}</TabsTrigger>
        {manage ? <TabsTrigger value="messages">{t("messages")}</TabsTrigger> : null}
        {chief ? <TabsTrigger value="export">{t("exportToGrades")}</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="results"><ResultsTable {...props} /></TabsContent>
      <TabsContent value="honor"><HonorBoard {...props} /></TabsContent>
      <TabsContent value="second"><SecondRound {...props} /></TabsContent>
      {manage ? <TabsContent value="messages"><Messages {...props} /></TabsContent> : null}
      {chief ? <TabsContent value="export"><ExportToGrades {...props} /></TabsContent> : null}
    </Tabs>
  )
}

function useResults(sessionId: string) {
  return useJc(["jc-results", sessionId], () => jcApi.results(sessionId))
}

function ResultsTable({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const r = useResults(sessionId)
  const [grade, setGrade] = useState<string>(o.grades[0]?.grade_level_id ?? "")
  const [search, setSearch] = useState("")
  if (r.error) return <Note tone="warning">{r.error.message}</Note>
  if (!r.data) return <Skeleton className="h-64" />
  const g = r.data.grades.find((x) => x.grade_level_id === grade) ?? r.data.grades[0]
  if (!g) return <EmptyCard text={t("noGradesYet")} />
  const pass = o.session.settings.exam_pass
  const rows = r.data.students
    .filter((s) => s.grade_level_id === g.grade_level_id && (!search || s.name.includes(search) || String(s.seat_number).includes(search)))
    .sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={g.grade_level_id} onValueChange={setGrade}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{r.data.grades.map((x) => <SelectItem key={x.grade_level_id} value={x.grade_level_id}>{x.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="w-56" placeholder={t("searchStudent")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <DocButton sessionId={sessionId} doc="results" />
      </div>
      <Card>
        <CardContent className="max-h-[70vh] overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>{t("seatNumber")}</TableHead>
                <TableHead>{t("studentName")}</TableHead>
                {g.subjects.map((s) => <TableHead key={s.key} className="text-center">{s.name}<span className="block text-xs font-normal">/{s.max}</span></TableHead>)}
                <TableHead>{t("percent")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell dir="ltr" className="text-start tabular-nums">{s.seat_number}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  {g.subjects.map((sub) => {
                    const v = s.scores[sub.key]
                    const below = v && !v.absent && v.score !== null && v.score / sub.max + 1e-9 < pass
                    return (
                      <TableCell key={sub.key} className={cn("text-center tabular-nums", (below || v?.absent) && "text-destructive")}>
                        {!v ? "—" : v.absent ? "غ" : Number(v.score)}
                      </TableCell>
                    )
                  })}
                  <TableCell className="tabular-nums font-semibold">{pct(s.pct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function HonorBoard({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const r = useJc(["jc-honor", sessionId], () => jcApi.honorBoard(sessionId))
  if (r.error) return <Note tone="warning">{r.error.message}</Note>
  if (!r.data) return <Skeleton className="h-40" />
  const byGrade = new Map<string, typeof r.data.rows>()
  for (const b of r.data.rows) byGrade.set(b.grade_level_name, [...(byGrade.get(b.grade_level_name) ?? []), b])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <DocButton sessionId={sessionId} doc="honor_board" />
        {r.data.unmasked ? <DocButton sessionId={sessionId} doc="certificates" /> : null}
        <span className="text-sm text-muted-foreground">{t("topNHint", { n: o.session.settings.top_n })} · {t("honorCompleteOnly")}</span>
      </div>
      {!byGrade.size ? <EmptyCard text={t("noResultsYet")} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...byGrade.entries()].map(([grade, list]) => (
            <Card key={grade}>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Trophy className="size-4 text-warning" />{grade}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {list.map((b, i) => (
                  <div key={`${b.place}-${i}`} className="flex items-center gap-3">
                    <span className={cn("flex size-7 items-center justify-center rounded-full text-sm font-bold", b.place === 1 ? "bg-warning/20 text-warning" : "bg-muted")}>{b.place}</span>
                    <span className={cn("flex-1 font-medium", !r.data!.unmasked && "text-muted-foreground")}>{b.name}</span>
                    <span className="tabular-nums">{pct(b.pct)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/** Second round (E3): from the grades module's decision (Art. 122 / 51); provisional = exam scores only. */
function SecondRound({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const router = useRouter()
  const list = useJc(o.rights.manage ? ["jc-round2", sessionId] : null, () => jcApi.secondRoundList(sessionId))
  const create = async () => {
    if (!window.confirm(t("confirmSecondRound"))) return
    const res = await jcApi.createSecondRound(sessionId)
    if (!res.success) {
      toast.error((res as { code?: string }).code === "round2_needs_grades" ? t("round2NeedsGrades") : res.error ?? "Error")
      return
    }
    toast.success(t("secondRoundCreated"))
    refresh()
    router.push(`?session=${res.data!.session_id}&tab=overview`)
  }
  if (!o.rights.manage) return <Note>{t("secondRoundManageOnly")}</Note>
  if (list.error) return <Note tone="warning">{list.error.message}</Note>
  if (!list.data) return <Skeleton className="h-40" />
  const d = list.data
  const provisional = d.source === "provisional"
  return (
    <div className="space-y-3">
      <Note tone={provisional ? "warning" : "success"}>
        <span className="font-semibold">{provisional ? t("round2Provisional") : t("round2FromGrades")}</span> — {d.note}
      </Note>
      <div className="flex flex-wrap items-center gap-2">
        <DocButton sessionId={sessionId} doc="second_round_list" />
        {o.rights.chief && o.session.round === "first" && d.students.length ? (
          <Button onClick={create} disabled={provisional} title={provisional ? t("round2NeedsGrades") : undefined}>
            <Repeat2 className="size-4" />{t("createSecondRound", { n: d.students.length })}
          </Button>
        ) : null}
      </div>
      {!d.students.length ? <EmptyCard text={t("noSecondRound")} /> : (
        <Card>
          <CardContent className="max-h-[60vh] overflow-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("seatNumber")}</TableHead>
                  <TableHead>{t("studentName")}</TableHead>
                  <TableHead>{t("grade")}</TableHead>
                  <TableHead>{t("subjects")}</TableHead>
                  <TableHead>{t("decision")}</TableHead>
                  <TableHead>{t("round2Seat")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.students.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell dir="ltr" className="text-start tabular-nums">{c.seat_number ?? "—"}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs">{c.grade_level_name}{c.section_name ? ` · ${c.section_name}` : ""}</TableCell>
                    <TableCell>{c.subjects.join("، ")}</TableCell>
                    <TableCell className="text-xs">{c.decision}</TableCell>
                    <TableCell dir="ltr" className="text-start tabular-nums">{c.round2_seat ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {d.excluded_over_limit.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("round2OverLimit")}</CardTitle>
            <CardDescription>{t("round2OverLimitHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {d.excluded_over_limit.map((x) => <span key={x.id} className="rounded bg-destructive/10 px-2 py-1">{x.name} · {x.grade_level_name} · {t("failedN", { n: x.failed })}</span>)}
          </CardContent>
        </Card>
      ) : null}
      {d.incomplete.length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("round2Incomplete")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {d.incomplete.map((x) => <p key={x.id}><span className="font-medium">{x.name}</span> · {x.grade_level_name}{x.missing ? ` — ${x.missing}` : ""}</p>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Messages({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const [note, setNote] = useState("")
  const [applied, setApplied] = useState("")
  const list = useJc(["jc-messages", sessionId, applied], () => jcApi.messages(sessionId, applied || undefined))
  const send = async () => {
    if (!window.confirm(t("confirmSend", { n: list.data?.length ?? 0 }))) return
    await jcRun(jcApi.sendMessages(sessionId, applied || undefined), t("sent"))
  }
  return (
    <div className="space-y-3">
      <Note>{t("messagesHint")}</Note>
      <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" dir="rtl">{o.session.settings.message_template}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-96 max-w-full" placeholder={t("messageNote")} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button variant="outline" onClick={() => setApplied(note)}>{t("preview")}</Button>
        <Button onClick={send} disabled={!list.data?.length}><Send className="size-4" />{t("sendPush")}</Button>
      </div>
      {!list.data ? <Skeleton className="h-40" /> : !list.data.length ? <EmptyCard text={t("noResultsYet")} /> : (
        <Card>
          <CardContent className="max-h-[60vh] overflow-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("studentName")}</TableHead><TableHead>{t("message")}</TableHead><TableHead>{t("phone")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="max-w-md text-xs" dir="rtl">{m.text}</TableCell>
                    <TableCell>
                      {m.whatsapp ? (
                        <Button size="sm" variant="outline" asChild>
                          <a href={m.whatsapp} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /><span dir="ltr">{m.phone}</span></a>
                        </Button>
                      ) : <span className="text-xs text-muted-foreground">{t("noPhone")}</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ExportToGrades({ sessionId }: TabProps) {
  const t = useTranslations("examControl")
  const preview = useJc(["jc-export", sessionId], () => jcApi.exportPreview(sessionId))
  const [done, setDone] = useState<JcExport | null>(null)
  const data = done ?? preview.data
  const commit = async () => {
    if (!window.confirm(t("confirmExport"))) return
    const res = await jcRun(jcApi.exportCommit(sessionId), t("exported"))
    if (res) setDone(res)
  }
  const changes = useMemo(() => data?.changes ?? [], [data])
  if (preview.error) return <Note tone="warning">{preview.error.message}</Note>
  if (!data) return <Skeleton className="h-40" />
  return (
    <div className="space-y-3">
      <Note>{t("exportHint")}</Note>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Tile label={t("export_new")} value={data.summary.new} tone="success" />
        <Tile label={t("export_change")} value={data.summary.change} tone={data.summary.change ? "warning" : "muted"} />
        <Tile label={t("export_same")} value={data.summary.same} />
        <Tile label={t("export_from_attendance")} value={data.summary.from_attendance ?? 0} tone="muted" />
        <Tile label={t("export_skipped")} value={data.summary.skipped ?? 0} tone={data.summary.skipped ? "destructive" : "muted"} />
        <Tile label={t("export_no_national_id")} value={data.summary.no_national_id ?? 0} tone={data.summary.no_national_id ? "warning" : "muted"} />
      </div>
      {data.skipped?.length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("exportSkipped")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {data.skipped.map((x, i) => <p key={i}><span className="font-medium">{x.name}</span> · {x.subject} — {t(`skip_${x.reason}`)}</p>)}
          </CardContent>
        </Card>
      ) : null}
      {data.committed ? <Note tone="success">{t("exportDone")}</Note> : (
        <Button onClick={commit} disabled={!data.summary.new && !data.summary.change}><Upload className="size-4" />{t("commitExport")}</Button>
      )}
      {changes.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("changesPreview")}</CardTitle>
            <CardDescription>{t("changesPreviewHint")}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("studentName")}</TableHead><TableHead>{t("nationalId")}</TableHead><TableHead>{t("subject")}</TableHead><TableHead>{t("exportTarget")}</TableHead><TableHead>{t("before")}</TableHead><TableHead /><TableHead>{t("after")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {changes.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell dir="ltr" className={cn("text-start text-xs tabular-nums", !c.national_id && "text-warning")}>{c.national_id ?? t("noNationalId")}</TableCell>
                    <TableCell>{c.subject}{c.from_attendance ? <span className="ms-1 rounded bg-muted px-1 text-xs">{t("fromAttendance")}</span> : null}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.target}</TableCell>
                    <TableCell className="tabular-nums">{c.before ?? "—"}</TableCell>
                    <TableCell><ArrowLeftRight className="size-3 text-muted-foreground" /></TableCell>
                    <TableCell className={cn("tabular-nums font-semibold", c.action === "change" && "text-warning")}>{c.after}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
