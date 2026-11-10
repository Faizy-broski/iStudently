"use client"

import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react"

import { publicVerifyReportCard } from "@/lib/api/jahbadh-insight"

/** Public page behind the QR printed on a Jahbadh report card (brief B6-39): no sign-in, minimal fields. */
export default function VerifyReportCardPage() {
  const t = useTranslations("grades")
  const params = useParams()
  const code = String(params.code ?? "")
  const { data: result, error, isLoading: loading } = useSWR(code ? ["jg-public-verify", code] : null, () => publicVerifyReportCard(code), { revalidateOnFocus: false })
  const failed = !!error

  const status = result?.status
  const rows: [string, string | null | undefined][] = result && status !== "not_found"
    ? [
        [t("insVerifySchool"), result.school], [t("insVerifyName"), result.name], [t("insVerifyGrade"), result.grade],
        [t("insVerifySection"), result.section], [t("insVerifyYear"), result.year], [t("insVerifyResult"), result.result],
        [t("insVerifyIssued"), result.issued_at ? new Date(result.issued_at).toLocaleDateString() : null],
      ]
    : []

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <ShieldCheck className="size-10 text-primary" />
          <h1 className="mt-2 text-xl font-bold">{t("insVerifyTitle")}</h1>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("insVerifying")}</p>
            </div>
          ) : failed ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertTriangle className="size-8 text-warning" />
              <p className="text-sm text-muted-foreground">{t("insVerifyError")}</p>
            </div>
          ) : status === "not_found" || !result ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-destructive/15"><XCircle className="size-8 text-destructive" /></div>
              <p className="text-lg font-bold text-destructive">{t("insVerifyNotFound")}</p>
              <p className="text-sm text-muted-foreground">{t("insVerifyNotFoundBody")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`flex size-14 items-center justify-center rounded-full ${status === "matches" ? "bg-success/15" : "bg-warning/15"}`}>
                  {status === "matches" ? <CheckCircle2 className="size-8 text-success" /> : <AlertTriangle className="size-8 text-warning" />}
                </div>
                <p className={`text-lg font-bold ${status === "matches" ? "text-success" : "text-warning"}`}>
                  {status === "matches" ? t("insVerifyValid") : t("insVerifyOutdated")}
                </p>
                {status === "outdated" ? <p className="text-sm text-muted-foreground">{t("insVerifyOutdatedBody")}</p> : null}
              </div>
              <div className="space-y-2 text-sm">
                {rows.filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-end font-semibold" dir="auto">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
