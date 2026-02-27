"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSchoolSettings, updateSchoolSettings } from "@/lib/api/school-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function HostelSettingsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // hostel-specific toggles
  const [autoRemove, setAutoRemove] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    fetchSettings();
  }, [schoolId]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await getSchoolSettings();
      if (res.success && res.data?.hostel) {
        setAutoRemove(!!res.data.hostel.auto_remove_inactive);
      }
    } catch {
      console.error("Failed to load hostel settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!schoolId) return;
    setSaving(true);
    try {
      const res = await updateSchoolSettings({
        hostel: {
          auto_remove_inactive: autoRemove,
        },
      });
      if (res.success) {
        toast.success("Hostel settings saved");
      } else {
        toast.error(res.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Hostel Configuration</h1>
      <Card>
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>Options for hostel rooms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto remove inactive students</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, inactive students will be automatically released from their room by the daily cron.
              </p>
            </div>
            <Switch checked={autoRemove} onCheckedChange={setAutoRemove} />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white">
              <Save className="mr-2 h-4 w-4"/>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
