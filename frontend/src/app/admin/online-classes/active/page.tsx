"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Video, Loader2, CalendarClock, StopCircle, AlertTriangle, RefreshCw } from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import {
  listActiveOnlineClasses, endOnlineClassSession, type OnlineClass,
} from "@/lib/api/online-classes"

export default function AdminActiveOnlineSessionsPage() {
  const t = useTranslations("online_classes")
  const campusCtx = useCampus()

  const [sessions, setSessions] = useState<OnlineClass[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ending, setEnding] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await listActiveOnlineClasses(campusCtx?.selectedCampus?.id)
    if (res.data) {
      setSessions(res.data)
      setLoadError(null)
    } else {
      setLoadError(res.error || t("network_error"))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [campusCtx?.selectedCampus?.id])

  const handleEnd = async (id: string) => {
    setEnding(id)
    const res = await endOnlineClassSession(id)
    setEnding(null)
    if (res.error) { toast.error(res.error || t("msg_end_failed")); return }
    toast.success(t("msg_ended"))
    load()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="h-6 w-6" /> {t("active_sessions_title")}</h1>
        <p className="text-muted-foreground mt-1">{t("active_sessions_subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : loadError ? (
        <Card><CardContent className="py-12 text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <p className="text-destructive font-medium">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("retry")}
          </Button>
        </CardContent></Card>
      ) : sessions.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Video className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{t("no_active_sessions")}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base" dir="auto">{s.title}</CardTitle>
                    <CardDescription>
                      {s.class_type === "existing_course" ? t("mode_existing_title") : t("mode_external_title")}
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    {t("status_active")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.started_at && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" /> {t("started_label")}: {new Date(s.started_at).toLocaleString()}
                  </span>
                )}
                <Button
                  size="sm" variant="outline" className="text-destructive gap-1.5"
                  disabled={ending === s.id} onClick={() => handleEnd(s.id)}
                >
                  {ending === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                  {t("end_session")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
