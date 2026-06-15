"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Save, AlertTriangle, Clock, DollarSign } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserQRCode } from "@/components/shared/UserQRCode";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { CURRENCY_OPTIONS } from "@/lib/api/school-settings";

export default function SuperAdminSettingsPage() {
  const { profile, user } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = usePlatformSettings();

  const [currency, setCurrency] = useState("USD");
  const [supportEmail, setSupportEmail] = useState("support@studently.com");
  const [maxSchools, setMaxSchools] = useState(1000);
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when settings load
  useEffect(() => {
    if (!settingsLoading) {
      setCurrency(settings.currency);
      setSupportEmail(settings.support_email);
      setMaxSchools(settings.max_schools);
    }
  }, [settingsLoading, settings]);

  // Ensure only super admins can access this page
  useEffect(() => {
    if (profile && profile.role !== 'super_admin') {
      window.location.href = `/${profile.role}/dashboard`;
    }
  }, [profile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateSettings({ currency, support_email: supportEmail, max_schools: maxSchools });
      if (res.success) {
        toast.success("Settings saved successfully");
      } else {
        toast.error(res.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const selectedCurrency = CURRENCY_OPTIONS.find(c => c.value === currency);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          Super Admin Settings
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Configure platform-wide system settings
        </p>
      </div>

      {/* System Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Configuration
          </CardTitle>
          <CardDescription>
            Manage platform-wide settings and configurations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input
              id="supportEmail"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@studently.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSchools">Maximum Schools Limit</Label>
            <Input
              id="maxSchools"
              type="number"
              value={maxSchools}
              onChange={(e) => setMaxSchools(parseInt(e.target.value) || 1000)}
              placeholder="1000"
            />
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={isSaving || settingsLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Currency Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Platform Currency
          </CardTitle>
          <CardDescription>
            Set the default currency for the super admin dashboard. School admins can override this per school in their own settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {CURRENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.symbol} {opt.value} — {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCurrency && (
              <p className="text-sm text-muted-foreground">
                Revenue on the dashboard will be displayed as:{" "}
                <strong>{selectedCurrency.value} 1,200</strong>
              </p>
            )}
          </div>

          <Button onClick={handleSave} disabled={isSaving || settingsLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Currency"}
          </Button>
        </CardContent>
      </Card>

      {/* Coming Soon Features */}
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Additional super admin features are under development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Platform analytics and monitoring</li>
            <li>System-wide announcement management</li>
            <li>Advanced security settings</li>
            <li>Backup and restore options</li>
            <li>API usage monitoring</li>
          </ul>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#022172]" />
            <CardTitle>Account Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Name:</span>
            <span className="font-medium">{profile?.first_name} {profile?.last_name}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium">{profile?.email || '—'}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium capitalize">{profile?.role}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Last login:</span>
            <span className="font-medium">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* QR Code */}
      {profile?.id && (
        <Card>
          <CardHeader>
            <CardTitle>My QR Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Scan to verify your identity. This QR code is unique to your account.</p>
            <UserQRCode
              value={profile.id}
              label={`${profile.first_name || ''} ${profile.last_name || ''} · ${profile.role}`.trim()}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
