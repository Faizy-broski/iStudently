"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { messagingApi, type MessageTemplate, type MessageRecipientOption } from "@/lib/api/messaging"
import { uploadMessageAttachment, type MessageAttachmentUploadResult } from "@/lib/api/media-upload"
import { playMessageSentSound } from "@/lib/utils/notification-sound"
import { useCampus } from "@/context/CampusContext"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Send, Search, Users, GraduationCap, Save, X, Paperclip, FileText } from "lucide-react"

const MAX_ATTACHMENTS = 5

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface MessageComposeProps {
  inboxHref: string
}

export function MessageCompose({ inboxHref }: MessageComposeProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campusContext = useCampus()
  const selectedCampusId = campusContext?.selectedCampus?.id
  const { profile } = useAuth()
  const canMessageStudents = profile?.role === "admin" || profile?.role === "teacher" || profile?.role === "super_admin"

  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [recipientTab, setRecipientTab] = useState<"staff" | "students">("staff")
  const [search, setSearch] = useState("")
  const [recipientOptions, setRecipientOptions] = useState<MessageRecipientOption[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set())
  const [knownRecipientNames, setKnownRecipientNames] = useState<Record<string, string>>({})
  const [replyToMessageId, setReplyToMessageId] = useState<string | undefined>(undefined)
  const [attachments, setAttachments] = useState<MessageAttachmentUploadResult[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)

  useEffect(() => {
    const replyTo = searchParams.get("reply_to")
    const replyName = searchParams.get("reply_name")
    const replySubject = searchParams.get("subject")
    const replyToMsgId = searchParams.get("reply_to_message_id")

    if (replyTo) {
      setSelectedProfileIds((prev) => new Set(prev).add(replyTo))
      if (replyName) {
        setKnownRecipientNames((prev) => ({ ...prev, [replyTo]: replyName }))
      }
    }
    if (replySubject) {
      setSubject(replySubject)
    }
    if (replyToMsgId) {
      setReplyToMessageId(replyToMsgId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [templateTitle, setTemplateTitle] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    messagingApi.listTemplates().then((res) => {
      if (res.success && res.data) setTemplates(res.data)
    })
  }, [])

  const fetchRecipients = useCallback(async () => {
    setLoadingRecipients(true)
    try {
      const res = await messagingApi.listRecipients(recipientTab, search.trim() || undefined, selectedCampusId)
      const options = res.success && res.data ? res.data : []
      setRecipientOptions(options)
      if (options.length > 0) {
        setKnownRecipientNames((prev) => {
          const next = { ...prev }
          for (const option of options) next[option.profileId] = option.name
          return next
        })
      }
    } finally {
      setLoadingRecipients(false)
    }
  }, [recipientTab, search, selectedCampusId])

  useEffect(() => {
    const timer = setTimeout(fetchRecipients, 300)
    return () => clearTimeout(timer)
  }, [fetchRecipients])

  const toggleRecipient = (profileId: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev)
      next.has(profileId) ? next.delete(profileId) : next.add(profileId)
      return next
    })
  }

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSubject(template.subject || "")
      setBody(template.body || "")
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim()) {
      toast.error("Enter a template title first")
      return
    }
    if (!subject.trim() && !body.trim()) {
      toast.error("Write a subject or message before saving as a template")
      return
    }
    setSavingTemplate(true)
    try {
      const res = await messagingApi.saveTemplate({
        title: templateTitle.trim(),
        subject,
        body,
        campus_id: selectedCampusId,
      })
      if (res.success && res.data) {
        setTemplates((prev) => [...prev, res.data as MessageTemplate].sort((a, b) => a.title.localeCompare(b.title)))
        setTemplateTitle("")
        toast.success("Template saved")
      } else {
        toast.error(res.error || "Failed to save template")
      }
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleAttachFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length === 0) return

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files`)
      return
    }

    setUploadingCount((c) => c + files.length)
    for (const file of files) {
      try {
        const res = await uploadMessageAttachment(file, selectedCampusId)
        if (res.success && res.data) {
          setAttachments((prev) => [...prev, res.data as MessageAttachmentUploadResult])
        } else {
          toast.error(res.error || `Failed to upload ${file.name}`)
        }
      } finally {
        setUploadingCount((c) => c - 1)
      }
    }
  }

  const removeAttachment = (path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path))
  }

  const handleSend = async () => {
    if (!subject.trim()) { toast.error("Subject is required"); return }
    if (!body.trim()) { toast.error("Message is required"); return }
    if (selectedProfileIds.size === 0) { toast.error("Select at least one recipient"); return }
    if (uploadingCount > 0) { toast.error("Please wait for attachments to finish uploading"); return }

    setSending(true)
    try {
      const res = await messagingApi.sendMessage({
        recipient_ids: Array.from(selectedProfileIds),
        subject: subject.trim(),
        body,
        campus_id: selectedCampusId,
        reply_to_message_id: replyToMessageId,
        attachments: attachments.map((a) => ({ url: a.url, name: a.name, mime_type: a.mime_type, size: a.size, path: a.path })),
      })
      if (res.success) {
        playMessageSentSound()
        toast.success("Message sent")
        setAttachments([])
        router.push(inboxHref)
      } else {
        toast.error(res.error || "Failed to send message")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> New Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {templates.length > 0 && (
            <div className="space-y-1.5 max-w-sm">
              <Label>Use a template</Label>
              <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a saved template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">
              Message <span className="text-destructive">*</span>
            </Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              campusId={selectedCampusId}
              showMediaRecorder
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="attachments" className="cursor-pointer">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>
                    <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                    Attach files
                  </span>
                </Button>
              </Label>
              <input
                id="attachments"
                type="file"
                multiple
                className="hidden"
                onChange={handleAttachFiles}
                disabled={uploadingCount > 0 || attachments.length >= MAX_ATTACHMENTS}
              />
              {uploadingCount > 0 && (
                <span className="text-xs text-muted-foreground">Uploading {uploadingCount}...</span>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <Badge key={a.path} variant="secondary" className="gap-1.5 py-1.5 pl-2 pr-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="max-w-[160px] truncate">{a.name}</span>
                    <span className="text-muted-foreground">({formatFileSize(a.size)})</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.path)}
                      className="ml-0.5 hover:text-destructive"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label htmlFor="template_title" className="text-xs text-muted-foreground">
                Save this as a template
              </Label>
              <Input
                id="template_title"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="Template title"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSaveTemplate} disabled={savingTemplate}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> {savingTemplate ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Recipients
              {selectedProfileIds.size > 0 && <Badge>{selectedProfileIds.size} selected</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedProfileIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSelectedProfileIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
              <Button onClick={handleSend} disabled={sending || uploadingCount > 0 || selectedProfileIds.size === 0} size="sm">
                <Send className="h-3.5 w-3.5 mr-1.5" /> {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedProfileIds.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selectedProfileIds).map((id) => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {knownRecipientNames[id] || "Unnamed"}
                  <button
                    type="button"
                    onClick={() => toggleRecipient(id)}
                    className="ml-0.5 hover:text-destructive"
                    aria-label="Remove recipient"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Tabs value={recipientTab} onValueChange={(v) => { setRecipientTab(v as "staff" | "students"); setSearch("") }}>
            <TabsList>
              <TabsTrigger value="staff"><Users className="h-3.5 w-3.5 mr-1.5" /> Users</TabsTrigger>
              {canMessageStudents && (
                <TabsTrigger value="students"><GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Students</TabsTrigger>
              )}
            </TabsList>

            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={recipientTab === "staff" ? "Search users..." : "Search students..."}
                className="pl-9"
              />
            </div>

            <TabsContent value="staff" className="mt-3">
              <RecipientList
                loading={loadingRecipients}
                items={recipientOptions}
                selected={selectedProfileIds}
                onToggle={toggleRecipient}
              />
            </TabsContent>
            {canMessageStudents && (
              <TabsContent value="students" className="mt-3">
                <RecipientList
                  loading={loadingRecipients}
                  items={recipientOptions}
                  selected={selectedProfileIds}
                  onToggle={toggleRecipient}
                />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function RecipientList({
  loading,
  items,
  selected,
  onToggle,
}: {
  loading: boolean
  items: { profileId: string; name: string; subtitle?: string }[]
  selected: Set<string>
  onToggle: (profileId: string) => void
}) {
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
  }
  if (items.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">No results found</div>
  }
  return (
    <div className="rounded-md border divide-y max-h-80 overflow-auto">
      {items.map((item) => {
        const isSelected = selected.has(item.profileId)
        return (
          <div
            key={item.profileId}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`}
            onClick={() => onToggle(item.profileId)}
          >
            <Checkbox checked={isSelected} onCheckedChange={() => onToggle(item.profileId)} onClick={(e) => e.stopPropagation()} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.name || "Unnamed"}</div>
              {item.subtitle && <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
