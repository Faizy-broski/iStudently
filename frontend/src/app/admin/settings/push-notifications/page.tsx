"use client"

import { useState, useEffect } from "react"
import { useCampus } from "@/context/CampusContext"
import { getPushStats, sendTestPush, type PushStats } from "@/lib/api/push-notifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { BellRing, FlaskConical, CheckCircle2, XCircle } from "lucide-react"
import { useTranslations } from "next-intl"

export default function PushNotificationsSettingsPage() {
  const t = useTranslations("school.push_notifications")
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id ?? null

  const [stats, setStats] = useState<PushStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPushStats(campusId).then((res) => {
      if (res.success && res.data) setStats(res.data)
      else toast.error(res.error || t("err_load_failed"))
    }).finally(() => setLoading(false))
  }, [campusId])

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await sendTestPush()
      if (res.success && res.data) {
        toast.success(t("msg_test_success", { count: res.data.sent }))
      } else {
        toast.error(res.error || t("msg_test_error"))
      }
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        {t("loading")}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BellRing className="h-6 w-6" /> {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("card_status_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.isConfigured ? (
            <Badge variant="outline" className="gap-1.5 border-green-300 text-green-700 dark:text-green-400 dark:border-green-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("status_configured")}
            </Badge>
          ) : (
            <div className="space-y-2">
              <Badge variant="outline" className="gap-1.5 border-red-300 text-red-700 dark:text-red-400 dark:border-red-800">
                <XCircle className="h-3.5 w-3.5" /> {t("status_not_configured")}
              </Badge>
              <p className="text-xs text-muted-foreground">{t("status_not_configured_hint")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscribers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("card_subscribers_title")}</CardTitle>
          <CardDescription>{t("card_subscribers_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-3xl font-bold">{stats?.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">{t("label_total")}</p>
          </div>

          {stats && stats.total > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{t("label_by_role")}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byRole).map(([role, count]) => (
                  <Badge key={role} variant="secondary" className="capitalize">
                    {role}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("no_subscribers")}</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> {t("card_test_title")}
          </CardTitle>
          <CardDescription>{t("card_test_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleTest} disabled={testing || !stats?.isConfigured}>
            {testing ? t("btn_testing") : t("btn_send_test")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
