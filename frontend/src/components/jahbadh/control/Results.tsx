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
import { DocButton, EmptyCard, Note, jcRun, pct, useJc, type TabProps } from "./shared"

export function ResultsTab(props: TabProps) {
  const t = useTranslations("examControl")
  const manage = props.overview.rights.manage
  const chief = props.overview.rights.chief
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
  const r = useResults(sessionId)
  if (r.error) return <Note tone="warning">{r.error.message}</Note>
  if (!r.data) return <Skeleton className="h-40" />
  const byGrade = new Map<string, typeof r.data.honor_board>()
  for (const b of r.data.honor_board) byGrade.set(b.grade_level_name, [...(byGrade.get(b.grade_level_name) ?? []), b])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <DocButton sessionId={sessionId} doc="honor_board" />
        <DocButton sessionId={sessionId} doc="certificates" />
        <span className="text-sm text-muted-foreground">{t("topNHint", { n: o.session.settings.top_n })}</span>
      </div>
      {!byGrade.size ? <EmptyCard text={t("noResultsYet")} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...byGrade.entries()].map(([grade, list]) => (
            <Card key={grade}>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Trophy className="size-4 text-warning" />{grade}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {list.map((b) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className={cn("flex size-7 items-center justify-center rounded-full text-sm font-bold", b.place === 1 ? "bg-warning/20 text-warning" : "bg-muted")}>{b.place}</span>
                    <span className="flex-1 font-medium">{b.name}</span>
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

function SecondRound({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const router = useRouter()
  const r = useResults(sessionId)
  const subjectName = (k: string) => o.grades.flatMap((g) => g.subjects).find((s) => s.key === k)?.name ?? k
  const create = async () => {
    if (!window.confirm(t("confirmSecondRound"))) return
    const res = await jcRun(jcApi.createSecondRound(sessionId), t("secondRoundCreated"))
    if (res) {
      refresh()
      router.push(`?session=${res.session_id}&tab=overview`)
    }
  }
  if (r.error) return <Note tone="warning">{r.error.message}</Note>
  if (!r.data) return <Skeleton className="h-40" />
  const list = r.data.second_round_candidates
  return (
    <div className="space-y-3">
      <Note>{t("secondRoundHint", { pass: Math.round(o.session.settings.exam_pass * 100) })}</Note>
      {o.rights.chief && o.session.round === "first" && list.length ? (
        <Button onClick={create}><Repeat2 className="size-4" />{t("createSecondRound", { n: list.length })}</Button>
      ) : null}
      {!list.length ? <EmptyCard text={t("noSecondRound")} /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("studentName")}</TableHead><TableHead>{t("subjects")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.subjects.map(subjectName).join("، ")}</TableCell>
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
      <div className="grid grid-cols-3 gap-3 md:max-w-xl">
        <Tile label={t("export_new")} value={data.summary.new} tone="success" />
        <Tile label={t("export_change")} value={data.summary.change} tone={data.summary.change ? "warning" : "muted"} />
        <Tile label={t("export_same")} value={data.summary.same} />
      </div>
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
              <TableHeader><TableRow><TableHead>{t("studentName")}</TableHead><TableHead>{t("subject")}</TableHead><TableHead>{t("before")}</TableHead><TableHead /><TableHead>{t("after")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {changes.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.subject}</TableCell>
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
