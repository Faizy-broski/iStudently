"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { grievancesApi, type GrievanceSettings } from "@/lib/api/grievances"

export function GrievanceSettingsForm() {
  const t = useTranslations("grievances.settings")
  const [settings, setSettings] = useState<GrievanceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    grievancesApi.getSettings().then((res) => {
      if (res.success && res.data) setSettings(res.data)
      setLoading(false)
    })
  }, [])

  const patch = (updates: Partial<GrievanceSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...updates } : prev))

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await grievancesApi.updateSettings(settings)
      if (res.success) toast.success(t("msg_saved"))
      else toast.error(res.error || t("err_save_failed"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!settings) return <p className="text-muted-foreground">{t("err_load_failed")}</p>

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>{t("label_sla_days")}</Label>
          <Input
            type="number"
            min={1}
            value={settings.sla_days_default}
            onChange={(e) => patch({ sla_days_default: parseInt(e.target.value) || 1 })}
            className="w-32"
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("label_max_attachment")}</Label>
          <Input
            type="number"
            min={1}
            value={settings.max_attachment_mb}
            onChange={(e) => patch({ max_attachment_mb: parseInt(e.target.value) || 1 })}
            className="w-32"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={settings.allow_anonymous} onCheckedChange={(v) => patch({ allow_anonymous: !!v })} />
            <span className="text-sm">{t("allow_anonymous")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={settings.allow_confidential} onCheckedChange={(v) => patch({ allow_confidential: !!v })} />
            <span className="text-sm">{t("allow_confidential")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={settings.allow_reopen} onCheckedChange={(v) => patch({ allow_reopen: !!v })} />
            <span className="text-sm">{t("allow_reopen")}</span>
          </label>
        </div>

        <div className="space-y-3">
          <Label>{t("notification_channels")}</Label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={settings.notification_channels.in_app}
              onCheckedChange={(v) => patch({ notification_channels: { ...settings.notification_channels, in_app: !!v } })}
            />
            <span className="text-sm">{t("in_app_notifications")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={settings.notification_channels.email}
              onCheckedChange={(v) => patch({ notification_channels: { ...settings.notification_channels, email: !!v } })}
            />
            <span className="text-sm">{t("email_notifications")}</span>
          </label>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("btn_save")}
        </Button>
      </CardContent>
    </Card>
  )
}
