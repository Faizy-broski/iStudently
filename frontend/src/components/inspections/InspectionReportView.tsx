"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Loader2, Building2, TrendingUp, Check, Clock, FileDown, FileUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/AuthContext"
import { getReport, getReportPdfSignedUrl, uploadReportPdf, type ReportDetail, type SignerRole } from "@/lib/api/inspection-report"
import { getEvaluation } from "@/lib/api/inspection-evaluation"
import { listNotes } from "@/lib/api/inspection-coaching"
import { generateReportPdfBlob } from "./InspectionReportDocument"
import { SignatureConfirmDialog } from "./SignatureConfirmDialog"

const ROLES: SignerRole[] = ["teacher", "principal", "inspector"]

export function InspectionReportView({ reportId, allowGeneratePdf = false }: { reportId: string; allowGeneratePdf?: boolean }) {
  const t = useTranslations("inspections.reports")
  const { profile } = useAuth()

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [viewingPdf, setViewingPdf] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getReport(reportId).then((res) => {
      if (res.error) toast.error(res.error)
      setReport(res.data)
      setLoading(false)
    })
  }, [reportId])

  useEffect(() => { load() }, [load])

  const handleGeneratePdf = async () => {
    if (!report) return
    setGenerating(true)
    try {
      const [evalRes, notesRes] = await Promise.all([
        getEvaluation(report.evaluation_id),
        listNotes(report.evaluation_id),
      ])
      if (evalRes.error || !evalRes.data) {
        toast.error(evalRes.error || t("err_generate_failed"))
        return
      }
      const blob = generateReportPdfBlob({
        report,
        evaluation: evalRes.data,
        notes: notesRes.data || [],
        schoolName: report.school?.name || "",
      })
      const uploadRes = await uploadReportPdf(reportId, blob)
      if (uploadRes.error) toast.error(uploadRes.error)
      else { toast.success(t("msg_pdf_generated")); load() }
    } finally {
      setGenerating(false)
    }
  }

  const handleViewPdf = async () => {
    setViewingPdf(true)
    try {
      const res = await getReportPdfSignedUrl(reportId)
      if (res.error) toast.error(res.error)
      else if (res.data) window.open(res.data.url, "_blank", "noopener,noreferrer")
    } finally {
      setViewingPdf(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!report) {
    return <div className="p-6 text-center text-gray-500">{t("report_not_found")}</div>
  }

  const signatureByRole = new Map(report.signatures.map((s) => [s.signer_role, s]))

  const isTeacher = profile?.id === report.teacher_profile_id
  const isInspector = profile?.id === report.inspector_profile_id
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin"
  const canAttemptSign = isTeacher || isInspector || isAdmin
  const alreadySignedByMe =
    (isTeacher && signatureByRole.has("teacher")) ||
    (isInspector && signatureByRole.has("inspector")) ||
    (isAdmin && signatureByRole.has("principal") && !isTeacher && !isInspector)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-[#022172]" />
                {report.school?.name}
              </CardTitle>
              <CardDescription>
                {report.teacher ? `${report.teacher.first_name} ${report.teacher.last_name}` : ""} · {report.inspector ? `${report.inspector.first_name} ${report.inspector.last_name}` : ""}
              </CardDescription>
            </div>
            <Badge variant={report.status === "fully_signed" ? "secondary" : "outline"}>
              {t(`status_${report.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {allowGeneratePdf && (
            <Button size="sm" variant="outline" className="gap-2" onClick={handleGeneratePdf} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {report.pdf_file_url ? t("btn_regenerate_pdf") : t("btn_generate_pdf")}
            </Button>
          )}
          {report.pdf_file_url && (
            <Button size="sm" variant="outline" className="gap-2" onClick={handleViewPdf} disabled={viewingPdf}>
              {viewingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {t("btn_view_pdf")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#022172]" />
            {t("signatures_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ROLES.map((role) => {
              const sig = signatureByRole.get(role)
              return (
                <div key={role} className={`rounded-md border p-3 ${sig ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
                    {sig ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Clock className="h-3.5 w-3.5 text-gray-400" />}
                    {t(`role_${role}`)}
                  </div>
                  {sig ? (
                    <>
                      <div className="text-sm text-gray-900">{sig.typed_full_name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{new Date(sig.attested_at).toLocaleString()}</div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">{t("pending_signature")}</div>
                  )}
                </div>
              )
            })}
          </div>

          {canAttemptSign && !alreadySignedByMe && (
            <div className="mt-4">
              <SignatureConfirmDialog reportId={reportId} onSigned={load} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
