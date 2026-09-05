"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { messagingApi, type MessageTemplate, type MessageRecipientOption } from "@/lib/api/messaging"
import { uploadMessageAttachment, type MessageAttachmentUploadResult } from "@/lib/api/media-upload"
import { playMessageSentSound } from "@/lib/utils/notification-sound"
import { useCampus } from "@/context/CampusContext"
import { useAuth } from "@/context/AuthContext"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { MultiSelectPopover } from "@/components/shared/MultiSelectPopover"
import { PaginationWrapper } from "@/components/ui/pagination"
import { Send, Search, Users, GraduationCap, Save, X, Paperclip, FileText } from "lucide-react"

const MAX_ATTACHMENTS = 10

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface MessageComposeProps {
  inboxHref: string
}

export function MessageCompose({ inboxHref }: MessageComposeProps) {
  const t = useTranslations("teacherPages.messagingWrite")
  const router = useRouter()
  const searchParams = useSearchParams()
  const campusContext = useCampus()
  const selectedCampusId = campusContext?.selectedCampus?.id
  const { profile } = useAuth()
  const canMessageStudents = profile?.role === "admin" || profile?.role === "teacher" || profile?.role === "super_admin"
  // Teachers may only message students in their own classes, school admins,
  // and staff their admin has approved — not other teachers or parents.
  // The "staff" tab is server-scoped to admins + the approved whitelist for
  // them; "teachers" and "parents" are hidden entirely. Enforced server-side
  // too (messaging.service.ts), this is just keeping the UI in sync with it.
  const isTeacher = profile?.role === "teacher"
  const { gradeLevels } = useGradeLevels()
  const { sections: allSections } = useSections()

  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [recipientTab, setRecipientTab] = useState<"teachers" | "staff" | "parents" | "students">("teachers")
  const [search, setSearch] = useState("")
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([])
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([])
  const [gradePopoverOpen, setGradePopoverOpen] = useState(false)
  const [sectionPopoverOpen, setSectionPopoverOpen] = useState(false)
  const [recipientOptions, setRecipientOptions] = useState<MessageRecipientOption[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [recipientPage, setRecipientPage] = useState(1)
  const [recipientTotal, setRecipientTotal] = useState(0)
  const [recipientTotalPages, setRecipientTotalPages] = useState(0)
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set())
  const [replyToMessageId, setReplyToMessageId] = useState<string | undefined>(undefined)
  const [attachments, setAttachments] = useState<MessageAttachmentUploadResult[]>([])
  const [uploadingCount, setUploadingCount] = useState(0)

  // Correct the selected tab once we know the role, if it landed on a tab
  // that's hidden for teachers.
  useEffect(() => {
    if (isTeacher && (recipientTab === "teachers" || recipientTab === "parents")) {
      setRecipientTab("students")
    }
  }, [isTeacher, recipientTab])

  useEffect(() => {
    const replyTo = searchParams.get("reply_to")
    const replySubject = searchParams.get("subject")
    const replyToMsgId = searchParams.get("reply_to_message_id")

    if (replyTo) {
      setSelectedProfileIds((prev) => new Set(prev).add(replyTo))
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

  const RECIPIENT_PAGE_SIZE = 25

  const fetchRecipients = useCallback(async () => {
    setLoadingRecipients(true)
    try {
      const filterApplies = recipientTab === "students" || recipientTab === "parents"
      const res = await messagingApi.listRecipients(
        recipientTab,
        search.trim() || undefined,
        selectedCampusId,
        filterApplies && selectedGradeIds.length > 0 ? selectedGradeIds : undefined,
        filterApplies && selectedSectionIds.length > 0 ? selectedSectionIds : undefined,
        recipientPage,
        RECIPIENT_PAGE_SIZE
      )
      const options = res.success && res.data ? res.data : []
      setRecipientOptions(options)
      setRecipientTotal(res.pagination?.total ?? 0)
      setRecipientTotalPages(res.pagination?.totalPages ?? 0)
    } finally {
      setLoadingRecipients(false)
    }
  }, [recipientTab, search, selectedCampusId, selectedGradeIds, selectedSectionIds, recipientPage])

  // Any filter/tab/search change should restart pagination from page 1.
  useEffect(() => {
    setRecipientPage(1)
  }, [recipientTab, search, selectedCampusId, selectedGradeIds, selectedSectionIds])

  // Sections belonging to any currently-selected grade — purely client-side,
  // useSections() already fetches every campus section unconditionally.
  // Grade-name-prefixed once 2+ grades are selected, since two different
  // grades can each have a same-named section (e.g. "Section A").
  const sections = useMemo(() => {
    const filtered = selectedGradeIds.length > 0
      ? allSections.filter((s) => selectedGradeIds.includes(s.grade_level_id))
      : []
    if (selectedGradeIds.length <= 1) return filtered
    return filtered.map((s) => {
      const gradeName = gradeLevels.find((g) => g.id === s.grade_level_id)?.name
      return { ...s, name: gradeName ? `${gradeName} - ${s.name}` : s.name }
    })
  }, [allSections, selectedGradeIds, gradeLevels])

  // Drop any selected sections that no longer belong to a currently selected grade.
  useEffect(() => {
    setSelectedSectionIds((prev) => prev.filter((id) => sections.some((s) => s.id === id)))
  }, [sections])

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

  const allVisibleSelected = recipientOptions.length > 0 && recipientOptions.every((o) => selectedProfileIds.has(o.profileId))

  const toggleSelectAllVisible = () => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const option of recipientOptions) next.delete(option.profileId)
      } else {
        for (const option of recipientOptions) next.add(option.profileId)
      }
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
      toast.error(t('enterTemplateTitleFirst'))
      return
    }
    if (!subject.trim() && !body.trim()) {
      toast.error(t('writeSubjectOrMessageBeforeSaving'))
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
        toast.success(t('templateSaved'))
      } else {
        toast.error(res.error || t('failedToSaveTemplate'))
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
      toast.error(t('canAttachUpTo', { max: MAX_ATTACHMENTS }))
      return
    }

    setUploadingCount((c) => c + files.length)
    for (const file of files) {
      try {
        const res = await uploadMessageAttachment(file, selectedCampusId)
        if (res.success && res.data) {
          setAttachments((prev) => [...prev, res.data as MessageAttachmentUploadResult])
        } else {
          toast.error(res.error || t('failedToUpload', { fileName: file.name }))
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
    if (!subject.trim()) { toast.error(t('subjectRequired')); return }
    if (!body.trim()) { toast.error(t('messageRequired')); return }
    if (selectedProfileIds.size === 0) { toast.error(t('selectAtLeastOneRecipient')); return }
    if (uploadingCount > 0) { toast.error(t('waitForAttachmentsToFinish')); return }

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
        toast.success(t('messageSent'))
        setAttachments([])
        router.push(inboxHref)
      } else {
        toast.error(res.error || t('failedToSendMessage'))
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
            <Send className="h-5 w-5" /> {t('newMessage')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {templates.length > 0 && (
            <div className="space-y-1.5 max-w-sm">
              <Label>{t('useATemplate')}</Label>
              <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={t('chooseASavedTemplate')} />
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
              {t('subject')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('messageSubject')}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">
              {t('message')} <span className="text-destructive">*</span>
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
                    {t('attachFiles')}
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
                <span className="text-xs text-muted-foreground">{t('uploadingCount', { count: uploadingCount })}</span>
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
                      aria-label={t('removeAttachment')}
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
                {t('saveThisAsATemplate')}
              </Label>
              <Input
                id="template_title"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder={t('templateTitle')}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSaveTemplate} disabled={savingTemplate}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> {savingTemplate ? t('saving') : t('saveTemplate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> {t('recipients')}
              {selectedProfileIds.size > 0 && <Badge>{t('selectedCount', { count: selectedProfileIds.size })}</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedProfileIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSelectedProfileIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1" /> {t('clear')}
                </Button>
              )}
              <Button onClick={handleSend} disabled={sending || uploadingCount > 0 || selectedProfileIds.size === 0} size="sm">
                <Send className="h-3.5 w-3.5 mr-1.5" /> {sending ? t('sending') : t('send')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs
            value={recipientTab}
            onValueChange={(v) => {
              setRecipientTab(v as "teachers" | "staff" | "parents" | "students")
              setSearch("")
              setSelectedGradeIds([])
              setSelectedSectionIds([])
            }}
          >
            <TabsList>
              {!isTeacher && (
                <TabsTrigger value="teachers"><Users className="h-3.5 w-3.5 mr-1.5" /> {t('teachers')}</TabsTrigger>
              )}
              <TabsTrigger value="staff"><Users className="h-3.5 w-3.5 mr-1.5" /> {isTeacher ? t('adminAndApprovedStaff') : t('staff')}</TabsTrigger>
              {!isTeacher && (
                <TabsTrigger value="parents"><Users className="h-3.5 w-3.5 mr-1.5" /> {t('parents')}</TabsTrigger>
              )}
              {canMessageStudents && (
                <TabsTrigger value="students"><GraduationCap className="h-3.5 w-3.5 mr-1.5" /> {isTeacher ? t('myStudents') : t('students')}</TabsTrigger>
              )}
            </TabsList>

            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchRecipientTab', { tab: t(recipientTab) })}
                className="pl-9"
              />
            </div>

            {(recipientTab === "students" || recipientTab === "parents") && (
              <div className="flex flex-wrap gap-2 mt-3">
                <MultiSelectPopover
                  options={gradeLevels.map((g) => ({ id: g.id, label: g.name }))}
                  selectedIds={selectedGradeIds}
                  onChange={setSelectedGradeIds}
                  placeholder={t('allGrades')}
                  emptyMessage={t('allGrades')}
                  open={gradePopoverOpen}
                  onOpenChange={setGradePopoverOpen}
                  className="w-55"
                />
                <MultiSelectPopover
                  options={sections.map((s) => ({ id: s.id, label: s.name }))}
                  selectedIds={selectedSectionIds}
                  onChange={setSelectedSectionIds}
                  placeholder={t('allSections')}
                  emptyMessage={t('allSections')}
                  disabled={selectedGradeIds.length === 0}
                  open={sectionPopoverOpen}
                  onOpenChange={setSectionPopoverOpen}
                  className="w-55"
                />
              </div>
            )}

            {!isTeacher && (
              <TabsContent value="teachers" className="mt-3">
                <RecipientList
                  loading={loadingRecipients}
                  items={recipientOptions}
                  selected={selectedProfileIds}
                  onToggle={toggleRecipient}
                  allSelected={allVisibleSelected}
                  onToggleSelectAll={toggleSelectAllVisible}
                />
              </TabsContent>
            )}
            <TabsContent value="staff" className="mt-3">
              <RecipientList
                loading={loadingRecipients}
                items={recipientOptions}
                selected={selectedProfileIds}
                onToggle={toggleRecipient}
                allSelected={allVisibleSelected}
                onToggleSelectAll={toggleSelectAllVisible}
              />
            </TabsContent>
            {!isTeacher && (
              <TabsContent value="parents" className="mt-3">
                <RecipientList
                  loading={loadingRecipients}
                  items={recipientOptions}
                  selected={selectedProfileIds}
                  onToggle={toggleRecipient}
                  allSelected={allVisibleSelected}
                  onToggleSelectAll={toggleSelectAllVisible}
                />
              </TabsContent>
            )}
            {canMessageStudents && (
              <TabsContent value="students" className="mt-3">
                <RecipientList
                  loading={loadingRecipients}
                  items={recipientOptions}
                  selected={selectedProfileIds}
                  onToggle={toggleRecipient}
                  allSelected={allVisibleSelected}
                  onToggleSelectAll={toggleSelectAllVisible}
                />
              </TabsContent>
            )}
          </Tabs>

          {!loadingRecipients && recipientTotal > 0 && (
            <PaginationWrapper
              currentPage={recipientPage}
              totalPages={recipientTotalPages}
              totalItems={recipientTotal}
              itemsPerPage={RECIPIENT_PAGE_SIZE}
              onPageChange={setRecipientPage}
            />
          )}
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
  allSelected,
  onToggleSelectAll,
}: {
  loading: boolean
  items: { profileId: string; name: string; subtitle?: string }[]
  selected: Set<string>
  onToggle: (profileId: string) => void
  allSelected: boolean
  onToggleSelectAll: () => void
}) {
  const t = useTranslations("teacherPages.messagingWrite")
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">{t('loading')}</div>
  }
  if (items.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">{t('noResultsFound')}</div>
  }
  return (
    <div className="rounded-md border divide-y max-h-80 overflow-auto">
      <div
        className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/40 bg-muted/20"
        onClick={onToggleSelectAll}
      >
        <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} onClick={(e) => e.stopPropagation()} />
        <div className="text-sm font-medium">
          {t('selectAllResults', { count: items.length })}
        </div>
      </div>
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
              <div className="text-sm font-medium truncate">{item.name || t('unnamed')}</div>
              {item.subtitle && <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
