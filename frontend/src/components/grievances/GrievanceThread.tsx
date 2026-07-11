"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, ArrowLeft, Send, Upload, ShieldAlert, Clock, AlertTriangle, Star } from "lucide-react"
import { AttachmentList, type AttachmentItem } from "@/components/shared/AttachmentList"
import { grievancesApi, type GrievanceDetail, type GrievanceStatus } from "@/lib/api/grievances"
import { messagingApi, type MessageRecipientOption } from "@/lib/api/messaging"
import { useAuth } from "@/context/AuthContext"

const STATUS_OPTIONS: GrievanceStatus[] = [
  "pending_review", "assigned", "under_investigation", "awaiting_info",
  "resolved", "closed", "rejected",
]

interface GrievanceThreadProps {
  grievanceId: string
  listHref: string
}

export function GrievanceThread({ grievanceId, listHref }: GrievanceThreadProps) {
  const t = useTranslations("grievances.thread")
  const tStatus = useTranslations("grievances.status")
  const tPriority = useTranslations("grievances.priority")
  const tList = useTranslations("grievances.list")
  const router = useRouter()
  const { profile } = useAuth()
  const [grievance, setGrievance] = useState<GrievanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState("")
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [posting, setPosting] = useState(false)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [staffOptions, setStaffOptions] = useState<MessageRecipientOption[]>([])
  const [assigneeId, setAssigneeId] = useState("")
  const [roleLabel, setRoleLabel] = useState("")
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await grievancesApi.get(grievanceId)
    if (res.success && res.data) {
      setGrievance(res.data)
    } else {
      toast.error(res.error || t("err_load_failed"))
    }
    setLoading(false)
  }, [grievanceId, t])

  useEffect(() => { load() }, [load])

  const isAdminRole = profile?.role === "admin" || profile?.role === "super_admin"

  useEffect(() => {
    if (!isAdminRole) return
    messagingApi.listRecipients("staff").then((res) => {
      if (res.success && res.data) setStaffOptions(res.data)
    })
  }, [isAdminRole])

  const handleAssign = async () => {
    if (!assigneeId) return
    setAssigning(true)
    try {
      const res = await grievancesApi.assign(grievanceId, assigneeId, roleLabel || undefined)
      if (res.success) {
        toast.success(t("msg_assigned"))
        setAssigneeId("")
        setRoleLabel("")
        load()
      } else {
        toast.error(res.error || t("err_assign_failed"))
      }
    } finally {
      setAssigning(false)
    }
  }

  const handleReply = async () => {
    if (!replyBody.trim()) return
    setPosting(true)
    try {
      const res = await grievancesApi.addComment(grievanceId, replyBody, isInternalNote)
      if (!res.success || !res.data) {
        toast.error(res.error || t("err_reply_failed"))
        return
      }

      for (const file of replyFiles) {
        const uploadResult = await grievancesApi.uploadAttachmentFile(grievanceId, file, res.data.id)
        if (!uploadResult.success) {
          toast.warning(t("err_upload_failed", { name: file.name, error: uploadResult.error || "" }))
        }
      }

      setReplyBody("")
      setReplyFiles([])
      setIsInternalNote(false)
      toast.success(isInternalNote ? t("msg_internal_note_added") : t("msg_reply_sent"))
      load()
    } finally {
      setPosting(false)
    }
  }

  const handleStatusChange = async (status: GrievanceStatus) => {
    const res = await grievancesApi.updateStatus(grievanceId, status)
    if (res.success) {
      toast.success(t("msg_status_updated"))
      load()
    } else {
      toast.error(res.error || t("err_status_failed"))
    }
  }

  const handleEscalate = async () => {
    const res = await grievancesApi.escalate(grievanceId)
    if (res.success) { toast.success(t("msg_escalated")); load() }
    else toast.error(res.error || t("err_escalate_failed"))
  }

  const handleReopen = async () => {
    const res = await grievancesApi.reopen(grievanceId)
    if (res.success) { toast.success(t("msg_reopened")); load() }
    else toast.error(res.error || t("err_reopen_failed"))
  }

  const handleFeedback = async (rating: number) => {
    setFeedbackRating(rating)
    const res = await grievancesApi.submitFeedback(grievanceId, rating)
    if (res.success) toast.success(t("msg_feedback_thanks"))
    else toast.error(res.error || t("err_feedback_failed"))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!grievance) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t("not_found")}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(listHref)}>{t("back_to_list")}</Button>
      </div>
    )
  }

  const isOwner = grievance.submitter_profile_id === profile?.id
  const isOverdue = !!grievance.due_date && new Date(grievance.due_date) < new Date() && !["resolved", "closed", "rejected"].includes(grievance.status)
  const rootAttachments: AttachmentItem[] = grievance.attachments.filter((a) => !a.comment_id)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push(listHref)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-mono text-muted-foreground">{grievance.complaint_number}</p>
              <CardTitle className="text-xl">{grievance.title}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{tPriority(grievance.priority)}</Badge>
              {grievance.is_confidential && <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" /> {tList("confidential")}</Badge>}
              {grievance.is_anonymous && <Badge variant="outline">{tList("anonymous")}</Badge>}
              {isOverdue && <Badge className="bg-red-100 text-red-800 gap-1"><AlertTriangle className="h-3 w-3" /> {tList("overdue")}</Badge>}
              <Badge>{tStatus(grievance.status)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm whitespace-pre-wrap">{grievance.description}</p>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {grievance.category?.name && <span>{t("category_label", { name: grievance.category.name })}</span>}
            {grievance.department && <span>{t("department_label", { name: grievance.department })}</span>}
            <span>{t("submitted_label", { date: new Date(grievance.submitted_at).toLocaleDateString() })}</span>
            {grievance.due_date && (
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t("due_label", { date: new Date(grievance.due_date).toLocaleDateString() })}</span>
            )}
          </div>

          {rootAttachments.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{t("attachments")}</p>
              <AttachmentList
                attachments={rootAttachments}
                resolveUrl={async (a) => {
                  const r = await grievancesApi.getAttachmentUrl(grievanceId, a.id)
                  return r.data?.url || "#"
                }}
              />
            </div>
          )}

          {grievance.can_manage && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Select value={grievance.status} onValueChange={(v) => handleStatusChange(v as GrievanceStatus)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleEscalate}>{t("btn_escalate")}</Button>
            </div>
          )}

          {isAdminRole && (
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("assign_to")}</p>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="w-56"><SelectValue placeholder={t("select_staff_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {staffOptions.map((s) => (
                      <SelectItem key={s.profileId} value={s.profileId}>{s.name}{s.subtitle ? ` (${s.subtitle})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("role_label_label")}</p>
                <input
                  className="h-9 w-40 rounded-md border px-3 text-sm"
                  placeholder={t("role_label_placeholder")}
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleAssign} disabled={assigning || !assigneeId}>
                {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : t("btn_assign")}
              </Button>
            </div>
          )}

          {isOwner && ["resolved", "closed"].includes(grievance.status) && (
            <div className="pt-2 border-t space-y-2">
              <Button variant="outline" size="sm" onClick={handleReopen}>{t("btn_reopen")}</Button>
              <div>
                <p className="text-sm font-medium mb-1">{t("rate_resolution")}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => handleFeedback(n)}>
                      <Star className={`h-5 w-5 ${n <= feedbackRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("conversation_title")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {grievance.comments.length === 0 && <p className="text-sm text-muted-foreground">{t("no_replies")}</p>}
          {grievance.comments.map((c) => {
            const commentAttachments = grievance.attachments.filter((a) => a.comment_id === c.id)
            return (
              <div key={c.id} className={`p-3 rounded-lg ${c.is_internal_note ? "bg-amber-50 border border-amber-200" : "bg-muted/40"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{c.author_profile_id === profile?.id ? t("you") : t("staff")}</span>
                  {c.is_internal_note && <Badge variant="outline" className="text-[10px]">{t("internal_note_badge")}</Badge>}
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                {commentAttachments.length > 0 && (
                  <div className="mt-2">
                    <AttachmentList
                      attachments={commentAttachments}
                      resolveUrl={async (a) => {
                        const r = await grievancesApi.getAttachmentUrl(grievanceId, a.id)
                        return r.data?.url || "#"
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          <Separator />

          <div className="space-y-2">
            <Textarea
              placeholder={t("reply_placeholder")}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              {replyFiles.map((f, i) => (
                <span key={i} className="text-xs bg-muted px-2 py-1 rounded">{f.name}</span>
              ))}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> {t("btn_attach")}
                </Button>
                <input
                  ref={fileRef} type="file" multiple className="hidden"
                  onChange={(e) => setReplyFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                />
                {grievance.can_manage && (
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={isInternalNote} onCheckedChange={(v) => setIsInternalNote(!!v)} />
                    {t("internal_note_checkbox")}
                  </label>
                )}
              </div>
              <Button size="sm" onClick={handleReply} disabled={posting || !replyBody.trim()} className="gap-2">
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("btn_send")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
