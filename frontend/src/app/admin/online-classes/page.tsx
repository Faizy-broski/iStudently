"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Video, Loader2, Users, CalendarClock, CheckCircle2, XCircle } from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import {
  listPendingOnlineClasses, approveOnlineClass, rejectOnlineClass, type OnlineClass,
} from "@/lib/api/online-classes"

export default function AdminOnlineClassesReviewPage() {
  const t = useTranslations("online_classes")
  const campusCtx = useCampus()

  const [requests, setRequests] = useState<OnlineClass[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [noteDialog, setNoteDialog] = useState<{ id: string; action: "approve" | "reject" } | null>(null)
  const [note, setNote] = useState("")

  const loadRequests = async () => {
    setLoading(true)
    const res = await listPendingOnlineClasses(campusCtx?.selectedCampus?.id)
    if (res.data) setRequests(res.data)
    setLoading(false)
  }

  useEffect(() => { loadRequests() }, [campusCtx?.selectedCampus?.id])

  const runAction = async (id: string, action: "approve" | "reject", withNote?: string) => {
    setActioning(id)
    const res = action === "approve" ? await approveOnlineClass(id, withNote) : await rejectOnlineClass(id, withNote)
    setActioning(null)
    if (res.error) { toast.error(res.error); return }
    toast.success(action === "approve" ? t("msg_approved") : t("msg_rejected"))
    setNoteDialog(null)
    setNote("")
    loadRequests()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="h-6 w-6" /> {t("review_queue")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin_subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : requests.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{t("no_pending_requests")}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base" dir="auto">{r.title}</CardTitle>
                    <CardDescription>
                      {r.class_type === "existing_course" ? t("mode_existing_title") : t("mode_external_title")}
                    </CardDescription>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {t("status_pending_review")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.description && <p className="text-sm text-muted-foreground" dir="auto">{r.description}</p>}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {r.scheduled_days && (
                    <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {r.scheduled_days} {r.session_start_time || ""}{r.session_end_time ? `–${r.session_end_time}` : ""}</span>
                  )}
                  {r.class_type === "external_open" && (
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t("capacity_label")}: {r.student_capacity}</span>
                  )}
                  {(r.start_date || r.end_date) && (
                    <span>{r.start_date || "—"} → {r.end_date || "—"}</span>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    disabled={actioning === r.id}
                    onClick={() => runAction(r.id, "approve")}
                    className="gap-1.5"
                  >
                    {actioning === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive gap-1.5"
                    disabled={actioning === r.id}
                    onClick={() => setNoteDialog({ id: r.id, action: "reject" })}
                  >
                    <XCircle className="h-4 w-4" /> {t("reject")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!noteDialog} onOpenChange={(open) => { if (!open) { setNoteDialog(null); setNote("") } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("reject")}</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("review_note_label")}</label>
            <textarea
              className="w-full min-h-[80px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
              value={note}
              onChange={e => setNote(e.target.value)}
              dir="auto"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNoteDialog(null); setNote("") }}>{t("cancel_action")}</Button>
            <Button
              variant="destructive"
              onClick={() => noteDialog && runAction(noteDialog.id, noteDialog.action, note.trim() || undefined)}
            >
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
