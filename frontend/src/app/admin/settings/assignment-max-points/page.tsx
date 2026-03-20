'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSchoolSettings, updateSchoolSettings } from '@/lib/api/school-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Info, Save, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export default function AssignmentMaxPointsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [maxPoints, setMaxPoints] = useState('100')

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSchoolSettings()
      if (result.success && result.data) {
        const cap = result.data.assignment_max_points
        if (cap != null) {
          setEnabled(true)
          setMaxPoints(String(cap))
        } else {
          setEnabled(false)
        }
      }
    } catch {
      toast.error('Failed to load settings')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    const parsed = parseInt(maxPoints, 10)
    if (enabled && (isNaN(parsed) || parsed < 1)) {
      toast.error('Max Points must be a positive number')
      return
    }
    setSaving(true)
    try {
      const result = await updateSchoolSettings({
        assignment_max_points: enabled ? parsed : null,
      })
      if (result.success) {
        toast.success('Assignment Max Points settings saved')
      } else {
        toast.error(result.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Assignment Max Points
          </h1>
          <p className="text-muted-foreground">
            Set a campus-wide maximum for gradebook assignment points
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">How it works</p>
          <p className="mt-1">
            When enabled, the server will reject any gradebook assignment whose
            <strong> Points</strong> field exceeds this value. Teachers and admins will also
            see a warning in real-time on the Mass Create Assignments page before submitting.
            This setting is per-campus.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#022172]" />
              Points Cap
            </CardTitle>
            <CardDescription>
              Enable and configure the maximum points allowed per assignment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Enable Max Points</Label>
                <p className="text-sm text-muted-foreground">
                  Reject assignments whose points exceed the cap
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className={!enabled ? 'opacity-50 pointer-events-none space-y-2' : 'space-y-2'}>
              <Label>Maximum Points</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={maxPoints}
                onChange={e => setMaxPoints(e.target.value)}
                className="w-40"
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                Assignments with Points above this value will be blocked
              </p>
            </div>
          </CardContent>
        </Card>

        {/* What is validated */}
        <Card>
          <CardHeader>
            <CardTitle>What is validated</CardTitle>
            <CardDescription>Both layers enforce the cap</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-[#022172] shrink-0" />
              <div>
                <p className="font-medium">Assignment creation (server-side)</p>
                <p className="text-muted-foreground mt-0.5">
                  The API rejects <code>points &gt; max</code> when creating or mass-creating
                  gradebook assignments. Returns a clear error message.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-[#57A3CC] shrink-0" />
              <div>
                <p className="font-medium">Mass Create Assignments (client-side)</p>
                <p className="text-muted-foreground mt-0.5">
                  The Points field shows a warning and the Create button is disabled
                  immediately when the value exceeds the cap — before the request is sent.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <div className="mt-0.5 h-2 w-2 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="font-medium">Grade entry (implicit)</p>
                <p className="text-muted-foreground mt-0.5">
                  Since assignment.points is already capped, student scores that the gradebook
                  displays as <code>/ max_points</code> also cannot exceed the cap.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white px-8"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
