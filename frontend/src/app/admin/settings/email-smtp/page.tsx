"use client"

import { useState, useEffect } from "react"
import { useCampus } from "@/context/CampusContext"
import { getSmtpSettings, updateSmtpSettings, testSmtpSettings, SmtpSettings } from "@/lib/api/school-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Mail, Save, FlaskConical, Eye, EyeOff, Info } from "lucide-react"
import { useTranslations } from "next-intl"

const DEFAULT: SmtpSettings = {
  smtp_host: "",
  smtp_port: 465,
  smtp_secure: true,
  smtp_user: "",
  smtp_pass: "",
  smtp_from_email: "",
  smtp_from_name: "",
  has_password: false,
}

export default function EmailSmtpSettingsPage() {
  const t = useTranslations("school.email_smtp")
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id ?? null

  const [form, setForm] = useState<SmtpSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [showPass, setShowPass] = useState(false)

  // ── Load settings ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    getSmtpSettings(campusId).then((res) => {
      if (res.success && res.data) setForm(res.data)
      else setForm(DEFAULT)
    }).finally(() => setLoading(false))
  }, [campusId])

  const set = (key: keyof SmtpSettings, value: any) =>
    setForm((f) => ({ ...f, [key]: value }))

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateSmtpSettings(form, campusId)
      if (res.success) toast.success(t("msg_save_success"))
      else toast.error(res.error || t("msg_save_error"))
    } finally {
      setSaving(false)
    }
  }

  // ── Test ─────────────────────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!testEmail.trim()) { toast.error(t("msg_test_no_email")); return }
    setTesting(true)
    try {
      const res = await testSmtpSettings({ ...form, test_email: testEmail.trim() }, campusId)
      if (res.success) toast.success(res.data?.message || t("msg_test_success"))
      else toast.error(res.error || t("msg_test_error"))
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        {t("loading")}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" /> {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle", { type: campusId ? t("type_campus") : t("type_school") })}
        </p>
      </div>

      {/* Server settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("card_server_title")}</CardTitle>
          <CardDescription>{t("card_server_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="smtp_host">{t("label_host")}</Label>
            <Input
              id="smtp_host"
              placeholder={t("placeholder_host")}
              value={form.smtp_host}
              onChange={(e) => set("smtp_host", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="smtp_port">{t("label_port")}</Label>
              <Input
                id="smtp_port"
                type="number"
                placeholder={t("placeholder_port")}
                value={form.smtp_port}
                onChange={(e) => set("smtp_port", parseInt(e.target.value, 10) || 465)}
              />
              <p className="text-xs text-muted-foreground">{t("hint_port")}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("label_encryption")}</Label>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  checked={form.smtp_secure}
                  onCheckedChange={(v) => set("smtp_secure", v)}
                />
                <span className="text-sm">
                  {form.smtp_secure ? t("encryption_ssl") : t("encryption_tls")}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("card_auth_title")}</CardTitle>
          <CardDescription>{t("card_auth_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="smtp_user">{t("label_user")}</Label>
            <Input
              id="smtp_user"
              placeholder={t("placeholder_user")}
              value={form.smtp_user}
              onChange={(e) => set("smtp_user", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp_pass">
              {t("label_pass")}
              {form.has_password && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {t("hint_pass_saved")}
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="smtp_pass"
                type={showPass ? "text" : "password"}
                placeholder={form.has_password ? t("placeholder_pass_existing") : t("placeholder_pass_new")}
                value={form.smtp_pass}
                onChange={(e) => set("smtp_pass", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* From address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("card_from_title")}</CardTitle>
          <CardDescription>{t("card_from_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="smtp_from_name">{t("label_from_name")}</Label>
            <Input
              id="smtp_from_name"
              placeholder={t("placeholder_from_name")}
              value={form.smtp_from_name}
              onChange={(e) => set("smtp_from_name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp_from_email">{t("label_from_email")}</Label>
            <Input
              id="smtp_from_email"
              type="email"
              placeholder={t("placeholder_from_email")}
              value={form.smtp_from_email}
              onChange={(e) => set("smtp_from_email", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick reference */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-4">
          <div className="flex gap-2 text-sm text-blue-800 dark:text-blue-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">{t("studently_server_title")}</p>
              <p>{t("studently_server_details", { host: <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">mail.istudent.ly</code>, port: <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">465</code>, user: <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">info@istudent.ly</code> })}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          {saving ? t("btn_saving") : t("btn_save")}
        </Button>
      </div>

      {/* Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> {t("card_test_title")}
          </CardTitle>
          <CardDescription>
            {t("card_test_subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={t("placeholder_test_email")}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? t("btn_testing") : t("btn_send_test")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
