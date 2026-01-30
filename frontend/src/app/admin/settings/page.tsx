"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Calendar, Save } from "lucide-react";

const HIJRI_OFFSET_KEY = "studently_global_hijri_offset";

export default function SettingsPage() {
  const [hijriOffset, setHijriOffset] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load saved offset from localStorage
    const saved = localStorage.getItem(HIJRI_OFFSET_KEY);
    if (saved !== null) {
      setHijriOffset(parseInt(saved));
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem(HIJRI_OFFSET_KEY, hijriOffset.toString());
      // Dispatch custom event to notify calendar components
      window.dispatchEvent(new CustomEvent('hijri-offset-changed', { detail: hijriOffset }));
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          System Settings
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Configure global system preferences
        </p>
      </div>

      {/* Hijri Calendar Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#022172]" />
            <CardTitle>Global Hijri Calendar Adjustment</CardTitle>
          </div>
          <CardDescription>
            Adjust the Hijri calendar display for the entire system. This affects all events and calendar views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Hijri Date Offset</Label>
            <RadioGroup
              value={hijriOffset.toString()}
              onValueChange={(value) => setHijriOffset(parseInt(value))}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="-1" id="minus-1" />
                <Label htmlFor="minus-1" className="flex-1 cursor-pointer">
                  <div className="font-medium">-1 Day</div>
                  <div className="text-sm text-muted-foreground">
                    Display Hijri dates one day earlier
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="0" id="zero" />
                <Label htmlFor="zero" className="flex-1 cursor-pointer">
                  <div className="font-medium">No Adjustment (0)</div>
                  <div className="text-sm text-muted-foreground">
                    Use standard Hijri calendar conversion
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="1" id="plus-1" />
                <Label htmlFor="plus-1" className="flex-1 cursor-pointer">
                  <div className="font-medium">+1 Day</div>
                  <div className="text-sm text-muted-foreground">
                    Display Hijri dates one day later
                  </div>
                </Label>
              </div>
            </RadioGroup>

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
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
