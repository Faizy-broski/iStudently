"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Video, Loader2, CalendarClock, XCircle, AlertTriangle, RefreshCw } from "lucide-react"
import {
  listMyOnlineClassEnrollments, withdrawFromOnlineClass, type OnlineClass,
} from "@/lib/api/online-classes"

export default function StudentMyEnrolledClassesPage() {
  const t = useTranslations("online_classes")
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Polled rather than fetched once — a teacher starting a session while
  // this page is already open used to require a manual reload for the Join
  // button to appear. 15s matches the poll interval used elsewhere for
  // similarly low-frequency lists (e.g. student/quizzes/page.tsx).
  const { data: res, isLoading, error: fetchError, mutate } = useSWR(
    "online-classes-enrolled",
    listMyOnlineClassEnrollments,
    { refreshInterval: 15000, revalidateOnFocus: true }
  )

  const classes = res?.data || []
  const loadError = fetchError ? t("network_error") : res?.error || null

  const handleWithdraw = async (id: string) => {
    setBusy(id)
    const withdrawRes = await withdrawFromOnlineClass(id)
    setBusy(null)
    if (withdrawRes.error) { toast.error(withdrawRes.error); return }
    toast.success(t("msg_withdrawn"))
    mutate()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="h-6 w-6" /> {t("my_enrolled_classes")}</h1>
        <p className="text-muted-foreground mt-1">{t("enrolled_subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : loadError ? (
        <Card><CardContent className="py-12 text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <p className="text-destructive font-medium">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => mutate()}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("retry")}
          </Button>
        </CardContent></Card>
      ) : classes.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Video className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{t("no_enrollments_yet")}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {classes.map(c => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base" dir="auto">{c.title}</CardTitle>
                {c.description && <CardDescription dir="auto">{c.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                {c.scheduled_days && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" /> {c.scheduled_days} {c.session_start_time || ""}{c.session_end_time ? `–${c.session_end_time}` : ""}
                  </span>
                )}
                <div className="flex gap-2">
                  {c.status === "active" && c.jitsi_room_id && (
                    <Button size="sm" onClick={() => router.push(`/student/jitsi-meet/rooms/${c.jitsi_room_id}`)} className="gap-1.5">
                      <Video className="h-4 w-4" /> {t("join_class")}
                    </Button>
                  )}
                  {c.class_type === "external_open" && (
                    <Button size="sm" variant="ghost" className="text-destructive gap-1.5" disabled={busy === c.id} onClick={() => handleWithdraw(c.id)}>
                      <XCircle className="h-4 w-4" /> {t("withdraw")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
