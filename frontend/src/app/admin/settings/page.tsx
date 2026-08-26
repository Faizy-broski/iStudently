"use client";

import { useState, useEffect } from "react";
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
      toast.success("Hijri offset saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCurrency = async () => {
    setCurrencySaving(true);
    try {
      const res = await updateSchoolSettings({ default_currency: defaultCurrency }, campusId);
      if (!res.success) throw new Error(res.error || "Failed to save");
      toast.success(campusId ? "Campus default currency saved" : "Default currency saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save currency");
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
      toast.success("Payment reminder settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save payment reminder settings");
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
      toast.success("Preferred date format saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save date format");
    } finally {
      setDateFormatSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#003dd6] bg-clip-text text-transparent">
          System Settings
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Configure global system preferences
        </p>
      </div>

      {/* Preferred Date Format Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>Preferred Date Format</CardTitle>
          </div>
          <CardDescription>
            Select how dates should be displayed across system reports, gradebooks, certificates, and portals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Date Format</Label>
            {paymentMethodLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Select value={preferredDateFormat} onValueChange={setPreferredDateFormatState}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Select date format" />
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
                Preview: <strong>{formatDateWithPreference(new Date(), preferredDateFormat)}</strong>
              </p>
            )}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> This preference applies system-wide to all date displays for school admins, teachers, parents, and students.
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
              {dateFormatSaving ? "Saving..." : "Save Date Format"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hijri Calendar Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>Global Hijri Calendar Adjustment</CardTitle>
          </div>
          <CardDescription>
            Adjust the Hijri calendar display for the entire system. This affects all events and calendar views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Hijri Date Offset</Label>
            <Select
              value={hijriOffset.toString()}
              onValueChange={(value) => setHijriOffset(parseInt(value))}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Select offset" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => i - 5).map((offset) => (
                  <SelectItem key={offset} value={offset.toString()}>
                    {offset === 0
                      ? 'No Adjustment (0)'
                      : `${offset > 0 ? '+' : ''}${offset} Day${Math.abs(offset) > 1 ? 's' : ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> This adjustment is useful for aligning with local moon sighting announcements.
                The offset will be applied to all Hijri dates shown throughout the system, including the calendar grid and event details.
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
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Reminder Pop-up / Toast Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>Overdue Payment Reminder Pop-up / Toast</CardTitle>
          </div>
          <CardDescription>
            Configure conditional overdue payment reminder toast shown to parents and students upon login or dashboard load.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50 dark:bg-slate-900/50">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Enable Payment Reminder</Label>
              <p className="text-sm text-muted-foreground">
                Trigger toast alert automatically on dashboard load if user has overdue tuition balance.
              </p>
            </div>
            <Switch
              checked={enablePaymentReminder}
              onCheckedChange={setEnablePaymentReminder}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Auto-dismiss Duration (seconds)</Label>
            <Select
              value={autoDismissSeconds.toString()}
              onValueChange={(val) => setAutoDismissSeconds(parseInt(val))}
              disabled={!enablePaymentReminder}
            >
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7, 8, 10, 15].map((sec) => (
                  <SelectItem key={sec} value={sec.toString()}>
                    {sec} seconds {sec === 5 ? "(Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Number of seconds before the toast automatically dismisses itself. Includes manual close button.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveReminderSettings}
              disabled={reminderSaving || paymentMethodLoading}
              className="bg-gradient-to-r from-[#57A3CC] to-[#003dd6] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {reminderSaving ? "Saving..." : "Save Reminder Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Default Currency Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>Default Currency</CardTitle>
          </div>
          <CardDescription>
            Set the default currency for{" "}
            {selectedCampus ? <strong>{selectedCampus.name}</strong> : "your school"}
            {". "}This will be used across fees, invoices, billing elements, and financial reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Currency</Label>
            {paymentMethodLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Select currency" />
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
                Selected:{" "}
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
                <strong>Note:</strong> This setting is campus-specific. Changing the currency does not
                convert existing monetary values — it only affects the symbol displayed on new records.
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
              {currencySaving ? "Saving..." : "Save Currency"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Default Payment Method Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#003dd6]" />
            <CardTitle>Default Payment Method</CardTitle>
          </div>
          <CardDescription>
            Set the default payment method for{" "}
            {selectedCampus ? (
              <strong>{selectedCampus.name}</strong>
            ) : (
              "your school"
            )}
            {". "}This will be pre-selected on all new invoices, fee payments, billing elements,
            accounting expenses and staff salary payments for this campus. Switch campuses using the
            campus selector to configure other campuses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Payment Method</Label>
            {paymentMethodLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <Select
                value={defaultPaymentMethod}
                onValueChange={(v) => setDefaultPaymentMethod(v as PaymentMethodOption)}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Select payment method" />
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
                <strong>Note:</strong> This setting is campus-specific. Each campus can have its own
                default payment method. Individual payment entries can still override the method at the
                time of recording. Changing this setting does not affect historical records.
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
              {paymentMethodSaving ? "Saving..." : "Save Payment Method"}
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
