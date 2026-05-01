"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { getNotificationSettings, saveNotificationSettings } from "@/lib/api/email"
import type { NotificationSettings } from "@/lib/api/email"
import { useCampus } from "@/context/CampusContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Bell, Save, UserX, Cake, CreditCard } from "lucide-react"

// ─── Shared form field ────────────────────────────────────────────────────────

function Field({
  label,
  id,
  children,
}: {
  label: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

// ─── Email template fields (subject / body / reply-to / copy-to / test) ───────

function EmailTemplateFields({
  values: v,
  onChange,
  t,
}: {
  values: Record<string, string>
  onChange: (key: string, val: string) => void
  t: (key: string) => string
}) {
  return (
    <div className="space-y-4">
      <Field label={t("email_subject_label")} id="subj">
        <Input
          id="subj"
          value={v.subject || ""}
          onChange={(e) => onChange("subject", e.target.value)}
          placeholder={t("email_subject_placeholder")}
          maxLength={200}
        />
      </Field>

      <Field label={t("email_body_label")} id="body">
        <Textarea
          id="body"
          value={v.body || ""}
          onChange={(e) => onChange("body", e.target.value)}
          rows={6}
          className="font-mono text-sm resize-y"
          placeholder={t("email_body_placeholder_short")}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label={t("email_reply_to")} id="reply">
          <Input
            id="reply"
            type="email"
            value={v.reply_to || ""}
            onChange={(e) => onChange("reply_to", e.target.value)}
            placeholder={t("email_reply_to_placeholder")}
          />
        </Field>
        <Field label={t("email_copy_to")} id="copy">
          <Input
            id="copy"
            type="email"
            value={v.copy_to || ""}
            onChange={(e) => onChange("copy_to", e.target.value)}
            placeholder={t("email_copy_to_placeholder")}
          />
        </Field>
        <Field label={t("email_test_email")} id="test">
          <Input
            id="test"
            type="email"
            value={v.test_email || ""}
            onChange={(e) => onChange("test_email", e.target.value)}
            placeholder={t("email_test_placeholder")}
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmailNotifications() {
  const t = useTranslations("email")
  const { selectedCampus } = useCampus()
  const campusId = selectedCampus?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [settings, setSettings] = useState<NotificationSettings>({})

  // ── Load settings (re-fetch when campus changes) ───────────────────────────

  useEffect(() => {
    setLoading(true)
    getNotificationSettings(campusId)
      .then((res) => {
        if (res.success && res.data) setSettings(res.data)
        else toast.error(res.error || t("notifications_load_failed"))
      })
      .finally(() => setLoading(false))
  }, [campusId])

  // ── Generic helpers ────────────────────────────────────────────────────────

  function patchAbsences(key: string, value: any) {
    setSettings((prev) => ({
      ...prev,
      absences: { is_active: false, ...(prev.absences || {}), [key]: value },
    }))
  }

  function patchBirthday(key: string, value: any) {
    setSettings((prev) => ({
      ...prev,
      birthday: { is_active: false, ...(prev.birthday || {}), [key]: value },
    }))
  }

  function patchPayments(key: string, value: any) {
    setSettings((prev) => ({
      ...prev,
      payments: { is_active: false, ...(prev.payments || {}), [key]: value },
    }))
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async (type: "absences" | "birthday" | "payments") => {
    setSaving(type)
    try {
      const payload = settings[type] || {}
      const res = await saveNotificationSettings(type, payload, campusId)
      if (res.success !== false) {
        toast.success(t("notifications_saved"))
      } else {
        toast.error((res as any).error || t("notifications_save_failed"))
      }
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        {t("loading_notifications")}
      </div>
    )
  }

  const absences = settings.absences || { is_active: false }
  const birthday = settings.birthday || { is_active: false }
  const payments = settings.payments || { is_active: false }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" /> {t("notifications_title")}
        </CardTitle>
        <CardDescription>
          {t("notifications_desc", { campus: selectedCampus?.name ?? t("school_fallback") })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="absences">
          <TabsList className="mb-6">
            <TabsTrigger value="absences" className="gap-1.5">
              <UserX className="h-3.5 w-3.5" /> {t("tab_absences")}
            </TabsTrigger>
            <TabsTrigger value="birthday" className="gap-1.5">
              <Cake className="h-3.5 w-3.5" /> {t("tab_birthday")}
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> {t("tab_payments")}
            </TabsTrigger>
          </TabsList>

          {/* ── Absences ────────────────────────────────────────────── */}
          <TabsContent value="absences" className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{t("absence_alert_title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("absence_alert_desc")}
                </p>
              </div>
              <Switch
                checked={absences.is_active}
                onCheckedChange={(v) => patchAbsences("is_active", v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={t("attendance_code_label")} id="att_code">
                <Input
                  id="att_code"
                  value={absences.attendance_code || ""}
                  onChange={(e) => patchAbsences("attendance_code", e.target.value)}
                  placeholder={t("attendance_code_placeholder")}
                />
              </Field>

              <Field label={t("threshold_label")} id="threshold">
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  value={absences.threshold_count ?? ""}
                  onChange={(e) => patchAbsences("threshold_count", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder={t("threshold_placeholder")}
                />
              </Field>

              <Field label={t("period_label")} id="period">
                <Select
                  value={absences.period || ""}
                  onValueChange={(v) => patchAbsences("period", v)}
                >
                  <SelectTrigger id="period">
                    <SelectValue placeholder={t("period_select")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school_year">{t("period_school_year")}</SelectItem>
                    <SelectItem value="semester">{t("period_semester")}</SelectItem>
                    <SelectItem value="quarter">{t("period_quarter")}</SelectItem>
                    <SelectItem value="month">{t("period_month")}</SelectItem>
                    <SelectItem value="week">{t("period_week")}</SelectItem>
                    <SelectItem value="day">{t("period_day")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <EmailTemplateFields
              values={absences as Record<string, string>}
              onChange={patchAbsences}
              t={t}
            />

            <Button onClick={() => save("absences")} disabled={saving === "absences"}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving === "absences" ? t("saving") : t("save_absence_settings")}
            </Button>
          </TabsContent>

          {/* ── Birthday ─────────────────────────────────────────────── */}
          <TabsContent value="birthday" className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{t("birthday_alert_title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("birthday_alert_desc")}
                </p>
              </div>
              <Switch
                checked={birthday.is_active}
                onCheckedChange={(v) => patchBirthday("is_active", v)}
              />
            </div>

            <EmailTemplateFields
              values={birthday as Record<string, string>}
              onChange={patchBirthday}
              t={t}
            />

            <Button onClick={() => save("birthday")} disabled={saving === "birthday"}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving === "birthday" ? t("saving") : t("save_birthday_settings")}
            </Button>
          </TabsContent>

          {/* ── Payments ─────────────────────────────────────────────── */}
          <TabsContent value="payments" className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{t("payment_alert_title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("payment_alert_desc")}
                </p>
              </div>
              <Switch
                checked={payments.is_active}
                onCheckedChange={(v) => patchPayments("is_active", v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("days_before_due")} id="days_before">
                <Input
                  id="days_before"
                  type="number"
                  min={0}
                  value={payments.days_before_due ?? ""}
                  onChange={(e) => patchPayments("days_before_due", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder={t("days_before_due_placeholder")}
                />
              </Field>
              <Field label={t("days_after_due")} id="days_after">
                <Input
                  id="days_after"
                  type="number"
                  min={0}
                  value={payments.days_after_due ?? ""}
                  onChange={(e) => patchPayments("days_after_due", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder={t("days_after_due_placeholder")}
                />
              </Field>
            </div>

            <EmailTemplateFields
              values={payments as Record<string, string>}
              onChange={patchPayments}
              t={t}
            />

            <Button onClick={() => save("payments")} disabled={saving === "payments"}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving === "payments" ? t("saving") : t("save_payment_settings")}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
