"use client"

import { useState, useEffect } from "react"
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
}: {
  values: Record<string, string>
  onChange: (key: string, val: string) => void
}) {
  return (
    <div className="space-y-4">
      <Field label="Subject" id="subj">
        <Input
          id="subj"
          value={v.subject || ""}
          onChange={(e) => onChange("subject", e.target.value)}
          placeholder="Email subject..."
          maxLength={200}
        />
      </Field>

      <Field label="Body (HTML supported)" id="body">
        <Textarea
          id="body"
          value={v.body || ""}
          onChange={(e) => onChange("body", e.target.value)}
          rows={6}
          className="font-mono text-sm resize-y"
          placeholder="Email body..."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Reply-To Email" id="reply">
          <Input
            id="reply"
            type="email"
            value={v.reply_to || ""}
            onChange={(e) => onChange("reply_to", e.target.value)}
            placeholder="reply@example.com"
          />
        </Field>
        <Field label="Copy To (CC)" id="copy">
          <Input
            id="copy"
            type="email"
            value={v.copy_to || ""}
            onChange={(e) => onChange("copy_to", e.target.value)}
            placeholder="admin@example.com"
          />
        </Field>
        <Field label="Test Email" id="test">
          <Input
            id="test"
            type="email"
            value={v.test_email || ""}
            onChange={(e) => onChange("test_email", e.target.value)}
            placeholder="Optional – all go here"
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmailNotifications() {
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
        else toast.error(res.error || "Failed to load notification settings")
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
        toast.success("Notification settings saved")
      } else {
        toast.error((res as any).error || "Failed to save")
      }
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Loading notification settings...
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
          <Bell className="h-5 w-5" /> Automated Notifications
        </CardTitle>
        <CardDescription>
          Configure automated emails sent by the system for{" "}
          <strong>{selectedCampus?.name ?? "the school"}</strong>.
          Changes take effect at the next scheduled run.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="absences">
          <TabsList className="mb-6">
            <TabsTrigger value="absences" className="gap-1.5">
              <UserX className="h-3.5 w-3.5" /> Absences
            </TabsTrigger>
            <TabsTrigger value="birthday" className="gap-1.5">
              <Cake className="h-3.5 w-3.5" /> Birthday
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Payments
            </TabsTrigger>
          </TabsList>

          {/* ── Absences ────────────────────────────────────────────── */}
          <TabsContent value="absences" className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Enable Absence Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Automatically email students/parents when absence threshold is reached.
                </p>
              </div>
              <Switch
                checked={absences.is_active}
                onCheckedChange={(v) => patchAbsences("is_active", v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Attendance Code (comma-separated)" id="att_code">
                <Input
                  id="att_code"
                  value={absences.attendance_code || ""}
                  onChange={(e) => patchAbsences("attendance_code", e.target.value)}
                  placeholder="e.g. A, UA"
                />
              </Field>

              <Field label="Threshold (number of absences)" id="threshold">
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  value={absences.threshold_count ?? ""}
                  onChange={(e) => patchAbsences("threshold_count", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 3"
                />
              </Field>

              <Field label="Period" id="period">
                <Select
                  value={absences.period || ""}
                  onValueChange={(v) => patchAbsences("period", v)}
                >
                  <SelectTrigger id="period">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school_year">School Year</SelectItem>
                    <SelectItem value="semester">Semester</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <EmailTemplateFields
              values={absences as Record<string, string>}
              onChange={patchAbsences}
            />

            <Button onClick={() => save("absences")} disabled={saving === "absences"}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving === "absences" ? "Saving..." : "Save Absence Settings"}
            </Button>
          </TabsContent>

          {/* ── Birthday ─────────────────────────────────────────────── */}
          <TabsContent value="birthday" className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Enable Birthday Emails</p>
                <p className="text-sm text-muted-foreground">
                  Automatically send a birthday email to students on their birthday.
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
            />

            <Button onClick={() => save("birthday")} disabled={saving === "birthday"}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving === "birthday" ? "Saving..." : "Save Birthday Settings"}
            </Button>
          </TabsContent>

          {/* ── Payments ─────────────────────────────────────────────── */}
          <TabsContent value="payments" className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Enable Payment Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Automatically email students/parents before or after fee due dates.
                </p>
              </div>
              <Switch
                checked={payments.is_active}
                onCheckedChange={(v) => patchPayments("is_active", v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Days Before Due Date" id="days_before">
                <Input
                  id="days_before"
                  type="number"
                  min={0}
                  value={payments.days_before_due ?? ""}
                  onChange={(e) => patchPayments("days_before_due", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 7"
                />
              </Field>
              <Field label="Days After Due Date" id="days_after">
                <Input
                  id="days_after"
                  type="number"
                  min={0}
                  value={payments.days_after_due ?? ""}
                  onChange={(e) => patchPayments("days_after_due", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 3"
                />
              </Field>
            </div>

            <EmailTemplateFields
              values={payments as Record<string, string>}
              onChange={patchPayments}
            />

            <Button onClick={() => save("payments")} disabled={saving === "payments"}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving === "payments" ? "Saving..." : "Save Payment Settings"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
