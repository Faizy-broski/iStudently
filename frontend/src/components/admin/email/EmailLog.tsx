"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { getEmailLog } from "@/lib/api/email"
import type { EmailLogEntry } from "@/lib/api/email"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { toast } from "sonner"
import {
  Mail,
  Eye,
  ChevronLeft,
  ChevronRight,
  Users,
  GraduationCap,
  AlertTriangle,
  FlaskConical,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"

function formatDate(iso: string) {
  try {
    return format(new Date(iso), "MMM d, yyyy h:mm a")
  } catch {
    return iso
  }
}

// ─── Email Detail Dialog ──────────────────────────────────────────────────────

function EmailDetailDialog({
  entry,
  open,
  onClose,
}: {
  entry: EmailLogEntry | null
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations("email")

  if (!entry) return null

  const senderName = entry.sent_by
    ? `${entry.sent_by.first_name || ""} ${entry.sent_by.last_name || ""}`.trim() || t("unknown_sender")
    : t("system_sender")

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {entry.subject}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border p-4 bg-muted/30">
            <div>
              <span className="text-muted-foreground font-medium">{t("detail_sent_by")}</span>{" "}
              {senderName}
            </div>
            <div>
              <span className="text-muted-foreground font-medium">{t("detail_date")}</span>{" "}
              {formatDate(entry.created_at)}
            </div>
            <div>
              <span className="text-muted-foreground font-medium">{t("detail_type")}</span>{" "}
              <Badge variant="outline" className="capitalize text-xs">
                {entry.recipient_type === "student" ? (
                  <><GraduationCap className="h-3 w-3 mr-1" />{t("type_students")}</>
                ) : (
                  <><Users className="h-3 w-3 mr-1" />{t("type_staff")}</>
                )}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground font-medium">{t("detail_recipients")}</span>{" "}
              {t("detail_recipients_value", { total: entry.total_recipients, sent: entry.success_count })}
              {entry.fail_count > 0 && (
                <span className="text-red-600 ml-2">
                  {t("detail_failed_value", { count: entry.fail_count })}
                </span>
              )}
            </div>
            {entry.cc && (
              <div className="col-span-2">
                <span className="text-muted-foreground font-medium">{t("detail_cc")}</span>{" "}
                {entry.cc}
              </div>
            )}
            {entry.is_test && (
              <div className="col-span-2">
                <Badge variant="secondary" className="gap-1">
                  <FlaskConical className="h-3 w-3" />
                  {t("detail_test_mode", { email: entry.test_email })}
                </Badge>
              </div>
            )}
          </div>

          {/* To addresses */}
          {entry.to_addresses && (
            <div>
              <p className="text-muted-foreground font-medium mb-1">{t("detail_sent_to")}</p>
              <p className="text-xs text-muted-foreground break-all leading-relaxed">
                {entry.to_addresses}
              </p>
            </div>
          )}

          {/* Body preview */}
          <div>
            <p className="text-muted-foreground font-medium mb-2">{t("detail_message")}</p>
            <div
              className="rounded-md border p-4 bg-white dark:bg-muted/20 prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: entry.body || "" }}
            />
          </div>

          {/* Errors */}
          {entry.errors?.length > 0 && (
            <div>
              <p className="text-muted-foreground font-medium mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> {t("detail_failed_deliveries")}
              </p>
              <div className="rounded-md border overflow-auto max-h-40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-1.5">{t("th_name")}</th>
                      <th className="text-left px-3 py-1.5">{t("th_email")}</th>
                      <th className="text-left px-3 py-1.5">{t("th_error")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.errors.map((e, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{e.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{e.email}</td>
                        <td className="px-3 py-1.5 text-red-600">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export function EmailLog() {
  const t = useTranslations("email")

  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const [startDate, setStartDate] = useState<string | undefined>(
    weekAgo.toISOString().split("T")[0]
  )
  const [endDate, setEndDate] = useState<string | undefined>(
    today.toISOString().split("T")[0]
  )

  const [entries, setEntries] = useState<EmailLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [selected, setSelected] = useState<EmailLogEntry | null>(null)

  const getSenderName = (entry: EmailLogEntry) => {
    if (!entry.sent_by) return t("system_sender")
    return `${entry.sent_by.first_name || ""} ${entry.sent_by.last_name || ""}`.trim() || t("unknown_sender")
  }

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEmailLog({
        page,
        limit: PAGE_SIZE,
        start_date: startDate,
        end_date: endDate,
      })

      if (res.success && res.data) {
        setEntries(res.data.data)
        setTotal(res.data.total)
        setTotalPages(res.data.totalPages)
      } else {
        toast.error(res.error || t("log_load_failed"))
      }
    } finally {
      setLoading(false)
    }
  }, [page, startDate, endDate])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  const applyFilter = () => {
    setPage(1)
    fetchLog()
  }

  return (
    <>
      <EmailDetailDialog
        entry={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> {t("page_log_title")}
              {total > 0 && (
                <Badge variant="secondary">{t("log_emails_count", { total })}</Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2 flex-wrap">
              <DateRangePicker
                from={startDate}
                to={endDate}
                onFromChange={setStartDate}
                onToChange={setEndDate}
              />
              <Button size="sm" onClick={applyFilter} disabled={loading}>
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t("go")
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("log_loading")}
            </div>
          ) : (
            <>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium">{t("th_date")}</th>
                      <th className="text-left px-4 py-3 font-medium">{t("th_sent_by")}</th>
                      <th className="text-left px-4 py-3 font-medium">{t("th_type")}</th>
                      <th className="text-left px-4 py-3 font-medium">{t("th_subject")}</th>
                      <th className="text-center px-4 py-3 font-medium">{t("th_total")}</th>
                      <th className="text-center px-4 py-3 font-medium">{t("th_sent")}</th>
                      <th className="text-center px-4 py-3 font-medium">{t("failed")}</th>
                      <th className="text-center px-4 py-3 font-medium">{t("th_test")}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-muted-foreground">
                          {t("log_no_emails")}
                        </td>
                      </tr>
                    ) : (
                      entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(entry.created_at)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {getSenderName(entry)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs gap-1">
                              {entry.recipient_type === "student" ? (
                                <>
                                  <GraduationCap className="h-3 w-3" />
                                  {t("type_students")}
                                </>
                              ) : (
                                <>
                                  <Users className="h-3 w-3" />
                                  {t("type_staff")}
                                </>
                              )}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <span className="truncate block" title={entry.subject}>
                              {entry.subject}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.total_recipients}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-green-600 font-medium">
                              {entry.success_count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.fail_count > 0 ? (
                              <span className="text-red-600 font-medium">
                                {entry.fail_count}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.is_test ? (
                              <Badge variant="secondary" className="text-xs">
                                <FlaskConical className="h-3 w-3" />
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(entry)}
                              className="h-7 px-2"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              {t("view")}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    {t("pagination_label", { page, totalPages, total })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || loading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
