"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, Upload, X, Send } from "lucide-react"
import { grievancesApi, type GrievanceCategory, type GrievancePriority, type GrievanceSettings } from "@/lib/api/grievances"
import { useAuth } from "@/context/AuthContext"

const PRIORITIES: GrievancePriority[] = ["low", "normal", "high", "urgent", "critical"]
const DEPARTMENT_KEYS = [
  "department_academic", "department_administration", "department_finance", "department_hr",
  "department_facilities", "department_it", "department_transportation", "department_other",
] as const

interface GrievanceSubmitFormProps {
  listHref: string
}

export function GrievanceSubmitForm({ listHref }: GrievanceSubmitFormProps) {
  const t = useTranslations("grievances.submit")
  const tPriority = useTranslations("grievances.priority")
  const router = useRouter()
  const { profile } = useAuth()

  const [categories, setCategories] = useState<GrievanceCategory[]>([])
  const [settings, setSettings] = useState<GrievanceSettings | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [priority, setPriority] = useState<GrievancePriority>("normal")
  const [department, setDepartment] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isConfidential, setIsConfidential] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    grievancesApi.getCategories().then((res) => {
      if (res.success && res.data) setCategories(res.data)
    })
    grievancesApi.getSettings().then((res) => {
      if (res.success && res.data) setSettings(res.data)
    }).catch(() => {
      // Non-admin roles may not have access to /grievances/settings; fall back to defaults.
    })
  }, [])

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...selected])
    e.target.value = ""
  }

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      toast.error(t("err_required"))
      return
    }
    if (!profile?.school_id) {
      toast.error(t("err_no_school"))
      return
    }

    setSubmitting(true)
    try {
      // Create the complaint first (need its ID for the attachment storage path).
      const created = await grievancesApi.create({
        title, description,
        category_id: categoryId || undefined,
        priority,
        department: department || undefined,
        is_anonymous: isAnonymous,
        is_confidential: isConfidential,
      })

      if (!created.success || !created.data) {
        toast.error(created.error || t("err_submit_failed"))
        return
      }

      const grievanceId = created.data.id

      for (const file of files) {
        const result = await grievancesApi.uploadAttachmentFile(grievanceId, file)
        if (!result.success) {
          toast.warning(t("err_upload_failed", { name: file.name, error: result.error || "" }))
        }
      }

      toast.success(t("msg_submitted", { number: created.data.complaint_number }))
      router.push(listHref)
    } catch {
      toast.error(t("err_submit_failed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label>{t("label_title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("label_description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={5} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("label_category")}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder={t("select_category_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("label_priority")}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as GrievancePriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{tPriority(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("label_department")}</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder={t("select_department_placeholder")} /></SelectTrigger>
              <SelectContent>
                {DEPARTMENT_KEYS.map((key) => (
                  <SelectItem key={key} value={t(key)}>{t(key)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            {settings?.allow_confidential !== false && (
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={isConfidential} onCheckedChange={(v) => setIsConfidential(!!v)} className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium">{t("confidential_title")}</span>
                  <br />
                  <span className="text-muted-foreground">{t("confidential_desc")}</span>
                </span>
              </label>
            )}
            {settings?.allow_anonymous !== false && (
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium">{t("anonymous_title")}</span>
                  <br />
                  <span className="text-muted-foreground">{t("anonymous_desc")}</span>
                </span>
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("label_attachments")}</Label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm bg-muted px-2.5 py-1.5 rounded-md">
                  <span className="truncate max-w-40">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> {t("btn_add_files")}
            </Button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={onFilesSelected} />
          </div>

          <Button type="submit" disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? t("btn_submitting") : t("btn_submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
