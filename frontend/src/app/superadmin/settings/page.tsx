"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Save, AlertTriangle, Clock, DollarSign, Palette, Loader2, Camera, KeyRound, MailX } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { UserQRCode } from "@/components/shared/UserQRCode";
import { ProfilePhoto } from "@/components/shared/ProfilePhoto";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { CURRENCY_OPTIONS } from "@/lib/api/school-settings";
import { messagingApi } from "@/lib/api/messaging";
import { updateProfile as updateOwnProfile, changePassword as changeOwnPassword } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export default function SuperAdminSettingsPage() {
  const { profile, user } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = usePlatformSettings();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) setAvatarUrl((profile as { avatar_url?: string | null }).avatar_url ?? null);
  }, [profile]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Allowed: JPG, PNG, WebP");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error("File too large. Maximum size is 2MB");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `superadmin/${profile?.id}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("staff_profile_photos")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from("staff_profile_photos").getPublicUrl(data.path);
      const publicUrl = urlData.publicUrl;

      const result = await updateOwnProfile({ avatar_url: publicUrl });
      if (!result.success) {
        toast.error(result.error || "Failed to save profile photo");
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changeOwnPassword(newPassword);
      if (result.success) {
        toast.success("Password changed successfully");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.error || "Failed to change password");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const [currency, setCurrency] = useState("USD");
  const [supportEmail, setSupportEmail] = useState("support@studently.com");
  const [maxSchools, setMaxSchools] = useState(1000);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteWindowMinutes, setDeleteWindowMinutes] = useState(0);
  const [isSavingMessaging, setIsSavingMessaging] = useState(false);

  useEffect(() => {
    messagingApi.getMessagingSettings().then((res) => {
      if (res.success && res.data) {
        setDeleteWindowMinutes(Number(res.data.delete_window_minutes) || 0);
      }
    });
  }, []);

  const handleSaveMessagingSettings = async () => {
    setIsSavingMessaging(true);
    try {
      const res = await messagingApi.updateMessagingSettings({ delete_window_minutes: deleteWindowMinutes });
      if (res.success) {
        toast.success("Messaging settings saved");
      } else {
        toast.error(res.error || "Failed to save messaging settings");
      }
    } finally {
      setIsSavingMessaging(false);
    }
  };

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

      {/* Messaging Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailX className="h-5 w-5" />
            Messaging — Delete Window
          </CardTitle>
          <CardDescription>
            How long after sending a message it can still be deleted (by admins, super admins, or users explicitly
            granted the Messaging permission). Set to 0 to disable message deletion entirely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="deleteWindowMinutes">Delete window (minutes)</Label>
            <Input
              id="deleteWindowMinutes"
              type="number"
              min={0}
              value={deleteWindowMinutes}
              onChange={(e) => setDeleteWindowMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
            />
          </div>

          <Button onClick={handleSaveMessagingSettings} disabled={isSavingMessaging}>
            <Save className="h-4 w-4 mr-2" />
            {isSavingMessaging ? "Saving..." : "Save Messaging Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Login Page Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Login Page Appearance
          </CardTitle>
          <CardDescription>
            Customize the background, colors, position and size of the platform login page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/superadmin/settings/login-page">
            <Button variant="outline">
              <Palette className="h-4 w-4 mr-2" />
              Customize Login Page
            </Button>
          </Link>
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
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-4">
            <ProfilePhoto src={avatarUrl} name={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`} size="lg" />
            <div>
              <label htmlFor="superadmin-avatar-upload">
                <Button type="button" variant="outline" size="sm" disabled={isUploadingAvatar} asChild>
                  <span className="cursor-pointer">
                    {isUploadingAvatar ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading...</>
                    ) : (
                      <><Camera className="h-3.5 w-3.5 mr-1.5" />{avatarUrl ? "Change Photo" : "Upload Photo"}</>
                    )}
                  </span>
                </Button>
              </label>
              <input
                id="superadmin-avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={isUploadingAvatar}
                onChange={handleAvatarChange}
              />
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP. Max 2MB</p>
            </div>
          </div>

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

          <div className="pt-3 border-t space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#022172]" />
              <span className="font-medium">Change Password</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs text-muted-foreground">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              size="sm"
            >
              {isChangingPassword ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Changing...</>
              ) : (
                "Update Password"
              )}
            </Button>
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
