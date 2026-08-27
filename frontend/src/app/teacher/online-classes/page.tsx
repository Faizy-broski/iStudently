"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Video, Loader2, Users, CalendarClock, XCircle } from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import { getMyCoursePeriods, type CoursePeriod } from "@/lib/api/courses"
import {
  submitOnlineClassRequest, listMyOnlineClassRequests, cancelOnlineClassRequest,
  startOnlineClassSession, type OnlineClass, type OnlineClassType, type OnlineClassStatus,
} from "@/lib/api/online-classes"

const STATUS_COLORS: Record<OnlineClassStatus, string> = {
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
}

const DAY_CODES: { code: string; labelKey: string }[] = [
  { code: "M", labelKey: "day_mon" }, { code: "T", labelKey: "day_tue" },
  { code: "W", labelKey: "day_wed" }, { code: "R", labelKey: "day_thu" },
  { code: "F", labelKey: "day_fri" }, { code: "S", labelKey: "day_sat" },
  { code: "U", labelKey: "day_sun" },
]

export default function TeacherOnlineClassesPage() {
  const t = useTranslations("online_classes")
  const router = useRouter()
  const campusCtx = useCampus()

  const [requests, setRequests] = useState<OnlineClass[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)

  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([])

  const [classType, setClassType] = useState<OnlineClassType>("external_open")
  const [coursePeriodId, setCoursePeriodId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [capacity, setCapacity] = useState("")
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const loadRequests = async () => {
    setLoading(true)
    const res = await listMyOnlineClassRequests()
    if (res.data) setRequests(res.data)
    setLoading(false)
  }

  useEffect(() => { loadRequests() }, [])

  useEffect(() => {
    if (isDialogOpen) {
      getMyCoursePeriods().then(setCoursePeriods).catch(() => setCoursePeriods([]))
    }
  }, [isDialogOpen])

  const toggleDay = (code: string) => {
    setSelectedDays(prev => prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code])
  }

  const resetForm = () => {
    setClassType("external_open"); setCoursePeriodId(""); setTitle(""); setDescription("")
    setCapacity(""); setSelectedDays([]); setStartTime(""); setEndTime(""); setStartDate(""); setEndDate("")
  }

  const handleCoursePeriodPick = (id: string) => {
    setCoursePeriodId(id)
    const cp = coursePeriods.find(c => c.id === id)
    if (cp && !title) setTitle(cp.course?.title || cp.title || "")
  }

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error(t("msg_title_required")); return }
    if (classType === "existing_course" && !coursePeriodId) {
      toast.error(t("msg_course_period_required")); return
    }
    if (classType === "external_open" && (!capacity || Number(capacity) <= 0)) {
      toast.error(t("msg_capacity_required")); return
    }

    setSubmitting(true)
    const res = await submitOnlineClassRequest({
      class_type: classType,
      course_period_id: classType === "existing_course" ? coursePeriodId : undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      student_capacity: classType === "external_open" ? Number(capacity) : undefined,
      scheduled_days: selectedDays.length > 0 ? selectedDays.join("") : undefined,
      session_start_time: startTime || undefined,
      session_end_time: endTime || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      campus_id: campusCtx?.selectedCampus?.id,
    })
    setSubmitting(false)

    if (res.error || !res.data) {
      toast.error(res.error || t("msg_submit_failed"))
      return
    }

    toast.success(t("msg_submit_success"))
    setIsDialogOpen(false)
    resetForm()
    loadRequests()
  }

  const handleCancel = async (id: string) => {
    const res = await cancelOnlineClassRequest(id)
    if (res.error) { toast.error(res.error); return }
    toast.success(t("msg_cancelled"))
    loadRequests()
  }

  const handleStart = async (id: string) => {
    setStarting(id)
    const res = await startOnlineClassSession(id)
    setStarting(null)
    if (res.error || !res.data) { toast.error(res.error || t("msg_start_failed")); return }
    router.push(`/teacher/jitsi-meet/rooms/${res.data.id}`)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="h-6 w-6" /> {t("heading")}</h1>
          <p className="text-muted-foreground mt-1">{t("teacher_subtitle")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm() }}>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t("request_class")}
          </Button>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("request_class")}</DialogTitle>
              <DialogDescription>{t("request_dialog_desc")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClassType("external_open")}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${classType === "external_open" ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/40"}`}
                >
                  <p className="font-medium text-sm">{t("mode_external_title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("mode_external_desc")}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setClassType("existing_course")}
                  className={`text-left rounded-lg border-2 p-3 transition-colors ${classType === "existing_course" ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/40"}`}
                >
                  <p className="font-medium text-sm">{t("mode_existing_title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("mode_existing_desc")}</p>
                </button>
              </div>

              {classType === "existing_course" && (
                <div className="space-y-1">
                  <Label>{t("course_period_label")} *</Label>
                  <Select value={coursePeriodId} onValueChange={handleCoursePeriodPick}>
                    <SelectTrigger><SelectValue placeholder={t("course_period_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      {coursePeriods.map(cp => (
                        <SelectItem key={cp.id} value={cp.id}>
                          {cp.course?.title || cp.title} {cp.section ? `— ${cp.section.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="oc-title">{t("title_label")} *</Label>
                <Input id="oc-title" value={title} onChange={e => setTitle(e.target.value)} dir="auto" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="oc-desc">{t("description_label")}</Label>
                <textarea
                  id="oc-desc"
                  className="w-full min-h-[70px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  value={description} onChange={e => setDescription(e.target.value)} dir="auto"
                />
              </div>

              {classType === "external_open" && (
                <div className="space-y-1">
                  <Label htmlFor="oc-capacity">{t("capacity_label")} *</Label>
                  <Input id="oc-capacity" type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} />
                </div>
              )}

              <div className="space-y-1">
                <Label>{t("days_label")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_CODES.map(d => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => toggleDay(d.code)}
                      className={`h-8 w-8 rounded-full text-xs font-medium border-2 transition-colors ${selectedDays.includes(d.code) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/20 text-muted-foreground hover:border-primary/40"}`}
                    >
                      {t(d.labelKey).slice(0, 1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="oc-start-time">{t("start_time_label")}</Label>
                  <Input id="oc-start-time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="oc-end-time">{t("end_time_label")}</Label>
                  <Input id="oc-end-time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="oc-start-date">{t("start_date_label")}</Label>
                  <Input id="oc-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="oc-end-date">{t("end_date_label")}</Label>
                  <Input id="oc-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t("cancel_action")}</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("submit_request")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : requests.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Video className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{t("no_requests_yet")}</p>
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
                  <Badge className={STATUS_COLORS[r.status]}>{t(`status_${r.status}`)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {r.scheduled_days && (
                    <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {r.scheduled_days}</span>
                  )}
                  {r.class_type === "external_open" && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {r.enrolled_count}/{r.student_capacity}
                    </span>
                  )}
                </div>
                {r.status === "rejected" && r.review_note && (
                  <p className="text-sm text-destructive">{t("rejection_reason")}: {r.review_note}</p>
                )}
                <div className="flex gap-2">
                  {r.status === "active" && (
                    <Button size="sm" onClick={() => handleStart(r.id)} disabled={starting === r.id} className="gap-1.5">
                      {starting === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                      {t("start_session")}
                    </Button>
                  )}
                  {["pending_review", "approved", "active"].includes(r.status) && (
                    <Button size="sm" variant="ghost" className="text-destructive gap-1.5" onClick={() => handleCancel(r.id)}>
                      <XCircle className="h-4 w-4" /> {t("cancel_request")}
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
