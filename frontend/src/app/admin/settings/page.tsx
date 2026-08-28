"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, CreditCard, DollarSign, Save, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getSchoolSettings, updateSchoolSettings, PAYMENT_METHOD_OPTIONS, CURRENCY_OPTIONS, PaymentMethodOption } from "@/lib/api/school-settings";
import { DATE_FORMAT_OPTIONS, getPreferredDateFormat, setPreferredDateFormat, formatDateWithPreference } from "@/lib/utils/dateFormat";
import { useCampus } from "@/context/CampusContext";

const HIJRI_OFFSET_KEY = "studently_global_hijri_offset";

export default function SettingsPage() {
  const t = useTranslations("admin.settings");
  const { selectedCampus } = useCampus();
  const campusId = selectedCampus?.id ?? null;

  const [hijriOffset, setHijriOffset] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Preferred Date Format
  const [preferredDateFormat, setPreferredDateFormatState] = useState<string>("MMMM d yyyy");
  const [dateFormatSaving, setDateFormatSaving] = useState(false);

  // Default payment method
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethodOption>("cash");
  const [paymentMethodSaving, setPaymentMethodSaving] = useState(false);
  const [paymentMethodLoading, setPaymentMethodLoading] = useState(true);

  // Default currency
  const [defaultCurrency, setDefaultCurrency] = useState<string>("USD");
  const [currencySaving, setCurrencySaving] = useState(false);

  // Payment Reminder Toast Settings
  const [enablePaymentReminder, setEnablePaymentReminder] = useState<boolean>(true);
  const [autoDismissSeconds, setAutoDismissSeconds] = useState<number>(5);
  const [reminderSaving, setReminderSaving] = useState(false);

  useEffect(() => {
    // Load campus-specific settings from server
    setPaymentMethodLoading(true);
    getSchoolSettings(campusId).then((res) => {
      if (res.success && res.data) {
        if (res.data.default_payment_method) setDefaultPaymentMethod(res.data.default_payment_method);
        if (res.data.default_currency) setDefaultCurrency(res.data.default_currency);
        if (res.data.preferred_date_format) {
          setPreferredDateFormatState(res.data.preferred_date_format);
          setPreferredDateFormat(res.data.preferred_date_format);
        } else {
          const saved = getPreferredDateFormat();
          if (saved) setPreferredDateFormatState(saved);
        }
        if (res.data.enable_payment_reminder !== undefined) setEnablePaymentReminder(res.data.enable_payment_reminder);
        if (res.data.auto_dismiss_seconds !== undefined) setAutoDismissSeconds(res.data.auto_dismiss_seconds);
        if (res.data.hijri_offset !== undefined && res.data.hijri_offset !== null) {
          setHijriOffset(res.data.hijri_offset);
          localStorage.setItem(HIJRI_OFFSET_KEY, res.data.hijri_offset.toString());
          window.dispatchEvent(new CustomEvent('hijri-offset-changed', { detail: res.data.hijri_offset }));
        } else {
          const saved = localStorage.getItem(HIJRI_OFFSET_KEY);
          if (saved !== null) setHijriOffset(parseInt(saved));
        }
      }
    }).finally(() => setPaymentMethodLoading(false));
  }, [campusId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateSchoolSettings({ hijri_offset: hijriOffset }, campusId);
      if (!res.success) throw new Error(res.error || "Failed to save");
      // Sync localStorage + dispatch event so all open CalendarGrids update instantly
      localStorage.setItem(HIJRI_OFFSET_KEY, hijriOffset.toString());
      window.dispatchEvent(new CustomEvent('hijri-offset-changed', { detail: hijriOffset }));
      toast.success(t("hijri.toast_success"));
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(t("hijri.toast_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePaymentMethod = async () => {
    setPaymentMethodSaving(true);
    try {
      const res = await updateSchoolSettings({ default_payment_method: defaultPaymentMethod }, campusId);
      if (!res.success) throw new Error(res.error || "Failed to save payment method");
      toast.success(campusId ? t("paymentMethod.toast_success_campus") : t("paymentMethod.toast_success"));
    } catch (error: any) {
      toast.error(error.message || t("paymentMethod.toast_error"));
    } finally {
      setPaymentMethodSaving(false);
    }
  };

  const handleSaveCurrency = async () => {
    setCurrencySaving(true);
    try {
      const res = await updateSchoolSettings({ default_currency: defaultCurrency }, campusId);
      if (!res.success) throw new Error(res.error || "Failed to save");
      toast.success(campusId ? t("currency.toast_success_campus") : t("currency.toast_success"));
    } catch (error: any) {
      toast.error(error.message || t("currency.toast_error"));
    } finally {
      setCurrencySaving(false);
    }
  };

  const handleSaveReminderSettings = async () => {
    setReminderSaving(true);
    try {
      const res = await updateSchoolSettings({
        enable_payment_reminder: enablePaymentReminder,
        auto_dismiss_seconds: autoDismissSeconds
      }, campusId);
      if (!res.success) throw new Error(res.error || "Failed to save payment reminder settings");
      toast.success(t("paymentReminder.toast_success"));
    } catch (error: any) {
      toast.error(error.message || t("paymentReminder.toast_error"));
    } finally {
      setReminderSaving(false);
    }
  };

  const handleSaveDateFormat = async () => {
    setDateFormatSaving(true);
    try {
      const res = await updateSchoolSettings({ preferred_date_format: preferredDateFormat }, campusId);
      if (!res.success) throw new Error(res.error || "Failed to save date format");
      setPreferredDateFormat(preferredDateFormat);
      toast.success(t("dateFormat.toast_success"));
    } catch (error: any) {
      toast.error(error.message || t("dateFormat.toast_error"));
    } finally {
      setDateFormatSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#003dd6] bg-clip-text text-transparent">
          {t("title")}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          {t("subtitle")}
        </p>
      </div>

      {/* Preferred Date Format Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>{t("dateFormat.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("dateFormat.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t("dateFormat.label")}</Label>
            {paymentMethodLoading ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : (
              <Select value={preferredDateFormat} onValueChange={setPreferredDateFormatState}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder={t("dateFormat.placeholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {DATE_FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.example}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!paymentMethodLoading && (
              <p className="text-sm text-muted-foreground">
                {t("dateFormat.preview")} <strong>{formatDateWithPreference(new Date(), preferredDateFormat)}</strong>
              </p>
            )}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>{t("note")}</strong> {t("dateFormat.note")}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSaveDateFormat}
              disabled={dateFormatSaving || paymentMethodLoading}
              className="bg-gradient-to-r from-[#57A3CC] to-[#003dd6] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {dateFormatSaving ? t("saving") : t("dateFormat.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hijri Calendar Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>{t("hijri.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("hijri.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t("hijri.label")}</Label>
            <Select
              value={hijriOffset.toString()}
              onValueChange={(value) => setHijriOffset(parseInt(value))}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder={t("hijri.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => i - 5).map((offset) => (
                  <SelectItem key={offset} value={offset.toString()}>
                    {offset === 0
                      ? t("hijri.noAdjustment")
                      : `${offset > 0 ? '+' : ''}${offset} ${Math.abs(offset) > 1 ? t("hijri.days") : t("hijri.day")}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>{t("note")}</strong> {t("hijri.note")}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gradient-to-r from-[#57A3CC] to-[#003dd6] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? t("saving") : t("hijri.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Reminder Pop-up / Toast Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>{t("paymentReminder.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("paymentReminder.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">{t("paymentReminder.enableLabel")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("paymentReminder.enableDescription")}
              </p>
            </div>
            <Switch
              checked={enablePaymentReminder}
              onCheckedChange={setEnablePaymentReminder}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">{t("paymentReminder.durationLabel")}</Label>
            <Select
              value={autoDismissSeconds.toString()}
              onValueChange={(val) => setAutoDismissSeconds(parseInt(val))}
              disabled={!enablePaymentReminder}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder={t("paymentReminder.durationPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7, 8, 10, 15].map((sec) => (
                  <SelectItem key={sec} value={sec.toString()}>
                    {sec} {t("paymentReminder.seconds")} {sec === 5 ? t("paymentReminder.default") : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("paymentReminder.durationHint")}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveReminderSettings}
              disabled={reminderSaving || paymentMethodLoading}
              className="bg-gradient-to-r from-[#57A3CC] to-[#003dd6] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {reminderSaving ? t("saving") : t("paymentReminder.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Default Currency Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>{t("currency.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("currency.description", { campus: selectedCampus ? selectedCampus.name : t("currency.yourSchool") })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t("currency.label")}</Label>
            {paymentMethodLoading ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : (
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder={t("currency.placeholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {CURRENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-mono text-muted-foreground w-8 inline-block">{opt.symbol}</span>
                      {opt.value} — {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!paymentMethodLoading && (
              <p className="text-sm text-muted-foreground">
                {t("currency.selected")}{" "}
                <strong>
                  {(() => {
                    const c = CURRENCY_OPTIONS.find(o => o.value === defaultCurrency);
                    return c ? `${c.symbol} ${c.value} — ${c.label}` : defaultCurrency;
                  })()}
                </strong>
              </p>
            )}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>{t("note")}</strong> {t("currency.note")}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSaveCurrency}
              disabled={currencySaving || paymentMethodLoading}
              className="bg-gradient-to-r from-[#57A3CC] to-[#003dd6] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {currencySaving ? t("saving") : t("currency.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Default Payment Method Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>{t("paymentMethod.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("paymentMethod.description", { campus: selectedCampus ? selectedCampus.name : t("paymentMethod.yourSchool") })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t("paymentMethod.label")}</Label>
            {paymentMethodLoading ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : (
              <Select
                value={defaultPaymentMethod}
                onValueChange={(v) => setDefaultPaymentMethod(v as PaymentMethodOption)}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder={t("paymentMethod.placeholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>{t("note")}</strong> {t("paymentMethod.note")}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSavePaymentMethod}
              disabled={paymentMethodSaving || paymentMethodLoading}
              className="bg-gradient-to-r from-[#57A3CC] to-[#003dd6] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {paymentMethodSaving ? t("saving") : t("paymentMethod.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
