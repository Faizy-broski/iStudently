"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Settings, Save, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SuperAdminSettingsPage() {
  const { profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    maxSchools: 1000,
    supportEmail: "support@studently.com"
  });

  // Ensure only super admins can access this page
  useEffect(() => {
    if (profile && profile.role !== 'super_admin') {
      window.location.href = `/${profile.role}/dashboard`;
    }
  }, [profile]);

  const handleSave = () => {
    setIsSaving(true);
    try {
      // TODO: Implement API call to save super admin settings
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
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
              value={systemSettings.supportEmail}
              onChange={(e) => setSystemSettings({ ...systemSettings, supportEmail: e.target.value })}
              placeholder="support@studently.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSchools">Maximum Schools Limit</Label>
            <Input
              id="maxSchools"
              type="number"
              value={systemSettings.maxSchools}
              onChange={(e) => setSystemSettings({ ...systemSettings, maxSchools: parseInt(e.target.value) })}
              placeholder="1000"
            />
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
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
    </div>
  );
}
