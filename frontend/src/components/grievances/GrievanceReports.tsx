"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, Download, FileSpreadsheet, FileText } from "lucide-react"
import { grievancesApi, type GrievanceReport, type GrievanceCategory } from "@/lib/api/grievances"
import { exportGrievancesToPdf, exportGrievancesToExcel, exportGrievancesToCsv } from "@/lib/utils/grievance-export"

export function GrievanceReports() {
  const t = useTranslations("grievances.reports")
  const tStatus = useTranslations("grievances.status")
  const tPriority = useTranslations("grievances.priority")
  const [categories, setCategories] = useState<GrievanceCategory[]>([])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [department, setDepartment] = useState("")
  const [status, setStatus] = useState("")
  const [report, setReport] = useState<GrievanceReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    grievancesApi.getCategories().then((res) => {
      if (res.success && res.data) setCategories(res.data)
    })
  }, [])

  const runReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await grievancesApi.getReport({
        from: from || undefined, to: to || undefined,
        category_id: categoryId || undefined, department: department || undefined, status: status || undefined,
      })
      if (res.success && res.data) setReport(res.data)
    } finally {
      setLoading(false)
    }
  }, [from, to, categoryId, department, status])

  useEffect(() => { runReport() }, [runReport])

  const kpiCards = report ? [
    { label: t("kpi_total"), value: report.kpis.total },
    { label: t("kpi_open"), value: report.kpis.open },
    { label: t("kpi_overdue"), value: report.kpis.overdue },
    { label: t("kpi_resolved"), value: report.kpis.resolved },
    { label: t("kpi_avg_resolution"), value: report.kpis.avg_resolution_days },
    { label: t("kpi_sla_compliance"), value: `${report.kpis.sla_compliance_rate}%` },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("label_from")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("label_to")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("label_category")}</Label>
            <Select value={categoryId || "__all__"} onValueChange={(v) => setCategoryId(v === "__all__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder={t("all")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("all")}</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("label_department")}</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder={t("any")} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("label_status")}</Label>
            <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("any")} />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : report ? (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
            {kpiCards.map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportGrievancesToPdf(report.rows)}>
              <FileText className="h-4 w-4" /> {t("btn_export_pdf")}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportGrievancesToExcel(report.rows)}>
              <FileSpreadsheet className="h-4 w-4" /> {t("btn_export_excel")}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportGrievancesToCsv(report.rows)}>
              <Download className="h-4 w-4" /> {t("btn_export_csv")}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-2">{t("th_number")}</th>
                    <th className="text-left p-2">{t("th_title")}</th>
                    <th className="text-left p-2">{t("th_category")}</th>
                    <th className="text-left p-2">{t("th_priority")}</th>
                    <th className="text-left p-2">{t("th_status")}</th>
                    <th className="text-left p-2">{t("th_submitted")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((g) => (
                    <tr key={g.id} className="border-b">
                      <td className="p-2 font-mono text-xs">{g.complaint_number}</td>
                      <td className="p-2">{g.title}</td>
                      <td className="p-2">{g.category?.name || "—"}</td>
                      <td className="p-2">{tPriority(g.priority)}</td>
                      <td className="p-2">{tStatus(g.status)}</td>
                      <td className="p-2">{new Date(g.submitted_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
