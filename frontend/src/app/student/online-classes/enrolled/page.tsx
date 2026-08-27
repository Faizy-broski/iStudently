"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Video, Loader2, CalendarClock, XCircle } from "lucide-react"
import {
  listMyOnlineClassEnrollments, withdrawFromOnlineClass, type OnlineClass,
} from "@/lib/api/online-classes"

export default function StudentMyEnrolledClassesPage() {
  const t = useTranslations("online_classes")
  const router = useRouter()
  const [classes, setClasses] = useState<OnlineClass[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await listMyOnlineClassEnrollments()
    if (res.data) setClasses(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleWithdraw = async (id: string) => {
    setBusy(id)
    const res = await withdrawFromOnlineClass(id)
    setBusy(null)
    if (res.error) { toast.error(res.error); return }
    toast.success(t("msg_withdrawn"))
    load()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="h-6 w-6" /> {t("my_enrolled_classes")}</h1>
        <p className="text-muted-foreground mt-1">{t("enrolled_subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
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
