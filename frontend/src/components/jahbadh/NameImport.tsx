"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, Eye, Printer, Upload } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { jgDataApi, type JgImportField, type JgImportInput, type JgImportMapping, type JgImportPreview, type JgImportResult } from "@/lib/api/jahbadh-data"
import { SectionPage, Tile, type JgBase } from "./shared"

/** «استيراد الأسماء» (brief B6 #25): paste or upload names, map columns, preview, then apply. Admin only. */
export function NameImport({ base }: { base: JgBase }) {
  const t = useTranslations("jgData")
  return (
    <SectionPage base={base} title={t("importTitle")} subtitle={t("importSubtitle")}>
      {(sectionId, campusId) => <ImportBody key={sectionId} sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function ImportBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("jgData")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [hasHeader, setHasHeader] = useState(true)
  const [overrides, setOverrides] = useState<JgImportMapping>({})
  const [preview, setPreview] = useState<JgImportPreview | null>(null)
  const [result, setResult] = useState<JgImportResult | null>(null)
  const [busy, setBusy] = useState(false)

  const input = (): JgImportInput => ({ text: file ? undefined : text, file, has_header: hasHeader, mapping: Object.keys(overrides).length ? overrides : undefined })
  const errorText = (code?: string, message?: string) => (code && t.has(`err_${code}`) ? t(`err_${code}`) : message)

  const runPreview = async () => {
    if (!file && !text.trim()) return toast.error(t("importNothing"))
    setBusy(true)
    const res = await jgDataApi.importPreview(sectionId, input(), campusId)
    setBusy(false)
    if (!res.success) return toast.error(errorText(res.code, res.error))
    setResult(null)
    setPreview(res.data!)
  }

  const apply = async () => {
    setBusy(true)
    const res = await jgDataApi.importApply(sectionId, input(), campusId)
    setBusy(false)
    if (!res.success) return toast.error(errorText(res.code, res.error))
    setResult(res.data!)
    setPreview(null)
    toast.success(t("importDone"))
  }

  const setColumn = (field: JgImportField, col: number) => {
    setOverrides((o) => ({ ...o, [field]: col }))
    setPreview(null)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Label htmlFor="jg-import-text">{t("importPaste")}</Label>
          <Textarea id="jg-import-text" dir="rtl" rows={6} value={text} disabled={!!file} onChange={(e) => { setText(e.target.value); setPreview(null) }} placeholder={t("importPasteHint")} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="size-4" />
                {file ? file.name : t("importFile")}
                <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null) }} />
              </label>
            </Button>
            {file ? <Button variant="ghost" size="sm" onClick={() => setFile(null)}>{t("importClearFile")}</Button> : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hasHeader} onCheckedChange={(v) => { setHasHeader(v === true); setPreview(null) }} />
              {t("importHasHeader")}
            </label>
            <Button onClick={runPreview} disabled={busy}><Eye className="size-4" />{t("importPreview")}</Button>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("importMapping")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("importField")}</TableHead>
                    <TableHead>{t("importDetected")}</TableHead>
                    <TableHead>{t("importUsed")}</TableHead>
                    <TableHead>{t("importFirstValue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.fields.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell dir="rtl">{f.label}</TableCell>
                      <TableCell className="tabular-nums">{preview.detected[f.key] ? colLabel(preview, preview.detected[f.key]) : "—"}</TableCell>
                      <TableCell>
                        <Select value={String(preview.mapping[f.key] ?? 0)} onValueChange={(v) => setColumn(f.key, Number(v))}>
                          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">{t("importNotUsed")}</SelectItem>
                            {Array.from({ length: preview.columns }, (_, i) => i + 1).map((c) => <SelectItem key={c} value={String(c)}>{colLabel(preview, c)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell dir="auto" className="text-muted-foreground">{preview.first_values[f.key] ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {Object.keys(overrides).length ? <p className="mt-2 text-xs text-muted-foreground">{t("importRerun")}</p> : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <Tile label={t("countTotal")} value={preview.counts.total} />
            <Tile label={t("countCreate")} value={preview.counts.create} tone="success" />
            <Tile label={t("countUpdate")} value={preview.counts.update} tone="success" />
            <Tile label={t("countSkip")} value={preview.counts.skip} />
            <Tile label={t("countErrors")} value={preview.counts.errors} tone="destructive" />
            <Tile label={t("countWarnings")} value={preview.counts.warnings} tone="warning" />
          </div>

          <Card>
            <CardContent className="overflow-auto pt-6" style={{ maxHeight: "60vh" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("line")}</TableHead>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("registrationNumber")}</TableHead>
                    <TableHead>{t("match")}</TableHead>
                    <TableHead>{t("action")}</TableHead>
                    <TableHead>{t("issues")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.line}>
                      <TableCell className="tabular-nums">{r.line}</TableCell>
                      <TableCell dir="rtl" className="whitespace-nowrap">{r.values.name ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{r.values.registration_number ?? "—"}</TableCell>
                      <TableCell>{r.match ? t(`matchBy_${r.match.by}`) : "—"}</TableCell>
                      <TableCell><Badge variant={r.action === "skip" ? "secondary" : "default"}>{t(`action_${r.action}`)}</Badge></TableCell>
                      <TableCell dir="rtl" className="text-xs">
                        {r.issues.map((i, n) => <p key={n} className={i.level === "error" ? "text-destructive" : "text-warning"}>{i.message}</p>)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={apply} disabled={busy || preview.counts.create + preview.counts.update === 0}>
              <CheckCircle2 className="size-4" />{t("importApply", { count: preview.counts.create + preview.counts.update })}
            </Button>
          </div>
        </>
      ) : null}

      {result ? <ImportSummary result={result} /> : null}
    </div>
  )
}

const colLabel = (p: JgImportPreview, col: number) => {
  const header = p.has_header ? p.headers[col - 1] : ""
  return header ? `${col} — ${header}` : String(col)
}

function ImportSummary({ result }: { result: JgImportResult }) {
  const t = useTranslations("jgData")
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("importSummary")}</CardTitle>
        {result.credentials.length ? <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" />{t("printCredentials")}</Button> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Tile label={t("countCreated")} value={result.created} tone="success" />
          <Tile label={t("countUpdated")} value={result.updated} tone="success" />
          <Tile label={t("countSkipped")} value={result.skipped} />
        </div>
        {result.not_stored.length ? <p className="rounded-lg bg-warning/15 p-2 text-sm text-warning">{t("notStored", { fields: result.not_stored.join("، ") })}</p> : null}
        {result.failed.length ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-destructive">{t("failedRows")}</p>
            {result.failed.map((f) => <p key={f.line} className="text-xs text-destructive" dir="rtl">{t("lineN", { line: f.line })}: {f.message}</p>)}
          </div>
        ) : null}
        {result.credentials.length ? (
          <>
            <p className="text-sm text-muted-foreground">{t("credentialsHint")}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("line")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("username")}</TableHead>
                  <TableHead>{t("password")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.credentials.map((c) => (
                  <TableRow key={c.student_id}>
                    <TableCell className="tabular-nums">{c.line}</TableCell>
                    <TableCell dir="rtl">{c.name}</TableCell>
                    <TableCell className="font-mono" dir="ltr">{c.username ?? "—"}</TableCell>
                    <TableCell className="font-mono" dir="ltr">{c.password ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
