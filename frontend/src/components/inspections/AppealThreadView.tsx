"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Loader2, MessageSquare, Lock, ArrowUpCircle, Check, X, Send } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useAuth } from "@/context/AuthContext"
import {
  getAppeal, addComment, updateAppealStatus, escalateAppeal, withdrawAppeal,
  listEscalationTargets, type AppealDetail, type AppealStatus, type EscalationTarget,
} from "@/lib/api/inspection-appeal"

const STATUS_STYLES: Record<AppealStatus, string> = {
  submitted: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  escalated: "bg-purple-100 text-purple-800",
  upheld: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-600",
}

const OPEN_STATUSES: AppealStatus[] = ["submitted", "under_review", "escalated"]

export function AppealThreadView({ appealId }: { appealId: string }) {
  const t = useTranslations("inspections.appeals")
  const { profile } = useAuth()

  const [appeal, setAppeal] = useState<AppealDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentBody, setCommentBody] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [posting, setPosting] = useState(false)
  const [acting, setActing] = useState(false)

  const [resolveOpen, setResolveOpen] = useState<"upheld" | "denied" | null>(null)
  const [resolutionNote, setResolutionNote] = useState("")

  const [escalateOpen, setEscalateOpen] = useState(false)
  const [targets, setTargets] = useState<EscalationTarget[]>([])
  const [targetId, setTargetId] = useState("")

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin"
  const isOwner = profile?.id === appeal?.teacher_profile_id

  const load = useCallback(() => {
    setLoading(true)
    getAppeal(appealId).then((res) => {
      if (res.error) toast.error(res.error)
      setAppeal(res.data)
      setLoading(false)
      if (res.data && isAdmin) {
        listEscalationTargets(res.data.school_id).then((r) => setTargets(r.data || []))
      }
    })
  }, [appealId, isAdmin])

  useEffect(() => { load() }, [load])

  const handleComment = async () => {
    if (!commentBody.trim()) return
    setPosting(true)
    try {
      const res = await addComment(appealId, commentBody.trim(), isInternal)
      if (res.error) toast.error(res.error)
      else { setCommentBody(""); setIsInternal(false); load() }
    } finally {
      setPosting(false)
    }
  }

  const handleStartReview = async () => {
    setActing(true)
    try {
      const res = await updateAppealStatus(appealId, "under_review")
      if (res.error) toast.error(res.error)
      else { toast.success(t("msg_status_updated")); load() }
    } finally {
      setActing(false)
    }
  }

  const handleResolve = async () => {
    if (!resolveOpen) return
    setActing(true)
    try {
      const res = await updateAppealStatus(appealId, resolveOpen, resolutionNote.trim() || undefined)
      if (res.error) toast.error(res.error)
      else { toast.success(t("msg_resolved")); setResolveOpen(null); setResolutionNote(""); load() }
    } finally {
      setActing(false)
    }
  }

  const handleEscalate = async () => {
    if (!targetId) return
    setActing(true)
    try {
      const res = await escalateAppeal(appealId, targetId)
      if (res.error) toast.error(res.error)
      else { toast.success(t("msg_escalated")); setEscalateOpen(false); setTargetId(""); load() }
    } finally {
      setActing(false)
    }
  }

  const handleWithdraw = async () => {
    setActing(true)
    try {
      const res = await withdrawAppeal(appealId)
      if (res.error) toast.error(res.error)
      else { toast.success(t("msg_withdrawn")); load() }
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!appeal) {
    return <div className="p-6 text-center text-gray-500">{t("appeal_not_found")}</div>
  }

  const isOpen = OPEN_STATUSES.includes(appeal.status)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{appeal.teacher ? `${appeal.teacher.first_name} ${appeal.teacher.last_name}` : ""}</CardTitle>
              <CardDescription>{new Date(appeal.created_at).toLocaleString()}</CardDescription>
            </div>
            <Badge className={STATUS_STYLES[appeal.status]} variant="outline">{t(`status_${appeal.status}`)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-500">{t("field_reason")}</Label>
            <p className="text-sm text-gray-800 mt-1">{appeal.reason}</p>
          </div>
          {appeal.resolution_note && (
            <div className="bg-gray-50 rounded-md p-3">
              <Label className="text-xs text-gray-500">{t("field_resolution_note")}</Label>
              <p className="text-sm text-gray-800 mt-1">{appeal.resolution_note}</p>
            </div>
          )}
          {appeal.assigned_to && (
            <p className="text-xs text-gray-500">{t("assigned_to_label")}: {appeal.assigned_to.first_name} {appeal.assigned_to.last_name}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {isAdmin && appeal.status === "submitted" && (
              <Button size="sm" variant="outline" onClick={handleStartReview} disabled={acting} className="gap-2">
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("btn_start_review")}
              </Button>
            )}
            {isAdmin && isOpen && (
              <>
                <Button size="sm" variant="outline" className="gap-2 text-green-700" onClick={() => setResolveOpen("upheld")}>
                  <Check className="h-4 w-4" />
                  {t("btn_uphold")}
                </Button>
                <Button size="sm" variant="outline" className="gap-2 text-destructive" onClick={() => setResolveOpen("denied")}>
                  <X className="h-4 w-4" />
                  {t("btn_deny")}
                </Button>
                <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <ArrowUpCircle className="h-4 w-4" />
                      {t("btn_escalate")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("dialog_escalate_title")}</DialogTitle></DialogHeader>
                    <div className="py-2 space-y-1.5">
                      <Label>{t("field_escalate_to")}</Label>
                      <Select value={targetId} onValueChange={setTargetId}>
                        <SelectTrigger><SelectValue placeholder={t("field_escalate_placeholder")} /></SelectTrigger>
                        <SelectContent>
                          {targets.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleEscalate} disabled={acting || !targetId} className="gap-2">
                        {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
                        {t("btn_confirm_escalate")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            {isOwner && isOpen && (
              <Button size="sm" variant="ghost" className="gap-2 text-destructive" onClick={handleWithdraw} disabled={acting}>
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("btn_withdraw")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!resolveOpen} onOpenChange={(open) => { if (!open) setResolveOpen(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{resolveOpen === "upheld" ? t("dialog_uphold_title") : t("dialog_deny_title")}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label>{t("field_resolution_note")}</Label>
            <Textarea rows={3} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleResolve} disabled={acting} className="gap-2">
              {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("btn_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#022172]" />
            {t("comments_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appeal.comments.length === 0 ? (
            <p className="text-sm text-gray-500">{t("no_comments")}</p>
          ) : (
            <div className="space-y-2">
              {appeal.comments.map((c) => (
                <div key={c.id} className={`rounded-md border p-2.5 text-sm ${c.is_internal_note ? "bg-amber-50 border-amber-200" : "bg-white"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {c.is_internal_note && (
                      <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-2.5 w-2.5" />{t("internal_note_badge")}</Badge>
                    )}
                    <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-800">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          {isOpen && (
            <div className="space-y-2 pt-2">
              <Textarea rows={2} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder={t("field_comment_placeholder")} />
              <div className="flex items-center justify-between">
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Checkbox id="internal-note" checked={isInternal} onCheckedChange={(v) => setIsInternal(!!v)} />
                    <Label htmlFor="internal-note" className="text-xs font-normal cursor-pointer">{t("field_internal_note")}</Label>
                  </div>
                )}
                <Button size="sm" onClick={handleComment} disabled={posting || !commentBody.trim()} className="gap-2 ml-auto">
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t("btn_post_comment")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
