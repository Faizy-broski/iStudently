'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Info, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useCampus } from '@/context/CampusContext'
import {
  getSetupAssistantConfig,
  updateSetupAssistantConfig,
  type SetupAssistantConfig,
} from '@/lib/api/setup-assistant'

const PROFILES: { key: string; label: string; description: string }[] = [
  { key: 'admin', label: 'Administrator', description: 'School setup: marking periods, grade levels, courses, etc.' },
  { key: 'teacher', label: 'Teacher', description: 'Timetable, attendance, assignments, gradebook.' },
  { key: 'parent', label: 'Parent', description: 'Portal, academics, attendance, homework.' },
  { key: 'student', label: 'Student', description: 'Profile, timetable, assignments, grades.' },
  { key: 'librarian', label: 'Librarian', description: 'Book catalog, loans, document fields.' },
]

export default function SetupAssistantConfigPage() {
  const campusCtx = useCampus()
  const selectedCampus = campusCtx?.selectedCampus ?? null
  const campusId = selectedCampus?.id ?? null

  const [config, setConfig] = useState<SetupAssistantConfig>({
    admin: true,
    teacher: true,
    parent: false,
    student: false,
    librarian: false,
  })
  const [savedConfig, setSavedConfig] = useState<SetupAssistantConfig>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getSetupAssistantConfig(campusId).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setConfig(res.data)
        setSavedConfig(res.data)
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [campusId])

  const handleToggle = (key: string, value: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateSetupAssistantConfig(config, campusId)
      if (res.success) {
        setSavedConfig(config)
        toast.success('Configuration saved')
      } else {
        toast.error(res.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Setup Assistant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure which user profiles see the guided Setup Assistant on their dashboard.
          {selectedCampus && (
            <span className="ml-1 font-medium text-[#022172]">
              Campus: {selectedCampus.name}
            </span>
          )}
        </p>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How It Works</p>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-700">
              <li>The Setup Assistant shows a checklist of recommended steps on each user&apos;s dashboard</li>
              <li>Users can check off steps as they complete them — progress is saved per user</li>
              <li>Once all steps are done, users can click &quot;Done&quot; to permanently hide the assistant</li>
              <li>Each campus can enable/disable the assistant independently per profile</li>
              <li>Admin and Teacher are enabled by default; Parent, Student, and Librarian are disabled</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profiles</CardTitle>
          <CardDescription>Enable or disable the Setup Assistant for each user profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-400">Loading…</div>
          ) : (
            <div className="space-y-4">
              {PROFILES.map((p) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <Label htmlFor={`sa-${p.key}`} className="text-sm font-medium">
                      {p.label}
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                  <Switch
                    id={`sa-${p.key}`}
                    checked={!!config[p.key]}
                    onCheckedChange={(val) => handleToggle(p.key, val)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
