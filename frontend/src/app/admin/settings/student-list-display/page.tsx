'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getSchoolSettings,
  updateSchoolSettings,
  type StudentListAppendConfig,
} from '@/lib/api/school-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Info, Save, Loader2, TableProperties } from 'lucide-react'
import { toast } from 'sonner'

// ─── Available fields ────────────────────────────────────────────────────────
// Each entry: { value: "category.field_key", label: string }
// "profile.*" resolves from student.profile; otherwise student.custom_fields[category][key]

const FIELD_OPTIONS = [
  { value: '', label: 'None' },
  { group: 'Profile', options: [
    { value: 'profile.email',  label: 'Email' },
    { value: 'profile.phone',  label: 'Phone' },
  ]},
  { group: 'System', options: [
    { value: 'system.username', label: 'Username' },
  ]},
  { group: 'Personal', options: [
    { value: 'personal.gender',        label: 'Gender' },
    { value: 'personal.date_of_birth', label: 'Date of Birth' },
    { value: 'personal.address',       label: 'Address' },
  ]},
  { group: 'Academic', options: [
    { value: 'academic.admission_date',    label: 'Admission Date' },
    { value: 'academic.previous_school',   label: 'Previous School' },
  ]},
]

const FLAT_FIELD_OPTIONS = [
  { value: '', label: 'None' },
  ...FIELD_OPTIONS.flatMap(g => ('options' in g ? g.options : [])),
]

const DEFAULT_CONFIG: StudentListAppendConfig = {
  enabled: false,
  field: 'system.username',
  field2: null,
  separator: ' / ',
}

export default function StudentListDisplayPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<StudentListAppendConfig>(DEFAULT_CONFIG)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSchoolSettings()
      if (result.success && result.data?.student_list_append_config) {
        setConfig({ ...DEFAULT_CONFIG, ...result.data.student_list_append_config })
      }
    } catch {
      toast.error('Failed to load settings')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await updateSchoolSettings({
        student_list_append_config: config.enabled ? config : { ...config, enabled: false },
      })
      if (result.success) {
        toast.success('Student list display settings saved')
      } else {
        toast.error(result.error || 'Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  const set = <K extends keyof StudentListAppendConfig>(key: K, value: StudentListAppendConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }))

  // Preview of what the grade cell will look like
  const previewGrade = 'Grade 9'
  const previewField = config.field === 'profile.email'
    ? 'student@school.com'
    : config.field === 'profile.phone'
      ? '+1 555 0100'
      : config.field === 'system.username'
        ? 'john.doe'
        : config.field
            ? config.field.split('.').pop() ?? ''
            : ''
  const previewField2 = config.field2 ? config.field2.split('.').pop() ?? '' : ''
  const preview = config.enabled && config.field
    ? `${previewGrade}${config.separator}${previewField}${config.field2 ? config.separator + previewField2 : ''}`
    : previewGrade

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
          <TableProperties className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Student List Display
          </h1>
          <p className="text-muted-foreground">
            Append a student field to the Grade column in the student listing
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">How it works</p>
          <p className="mt-1">
            When enabled, the selected field value is appended to the Grade cell in the
            Student Information listing — for example: <strong>Grade 9 / john.doe</strong>.
            Settings are per-campus. No database query change is needed; the value is
            read from student data already loaded on the page.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Enable + Primary field */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-[#022172]" />
              Append Field
            </CardTitle>
            <CardDescription>
              Choose which field to append to the Grade column
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Enable Append</Label>
                <p className="text-sm text-muted-foreground">
                  Show an extra field next to the grade level
                </p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={v => set('enabled', v)} />
            </div>

            <div className={!config.enabled ? 'opacity-50 pointer-events-none space-y-4' : 'space-y-4'}>
              {/* Primary field */}
              <div className="space-y-2">
                <Label>Primary Field</Label>
                <Select value={config.field || ''} onValueChange={v => set('field', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field…" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLAT_FIELD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value || '__none__'}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This value is appended after the grade level
                </p>
              </div>

              {/* Second field */}
              <div className="space-y-2">
                <Label>Second Field <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select
                  value={config.field2 || ''}
                  onValueChange={v => set('field2', v === '__none__' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {FLAT_FIELD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value || '__none__'}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Separator */}
              <div className="space-y-2">
                <Label>Separator</Label>
                <Input
                  value={config.separator}
                  onChange={e => set('separator', e.target.value)}
                  maxLength={10}
                  className="w-32"
                  placeholder=" / "
                />
                <p className="text-xs text-muted-foreground">
                  Characters placed between grade and field value
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              How the Grade column will appear in the student listing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Student ID</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Grade</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-4 py-3 font-medium">STU-001</td>
                    <td className="px-4 py-3">John Doe</td>
                    <td className="px-4 py-3 font-medium text-[#022172]">{preview}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    </td>
                  </tr>
                  <tr className="border-t bg-muted/20">
                    <td className="px-4 py-3 font-medium">STU-002</td>
                    <td className="px-4 py-3">Jane Smith</td>
                    <td className="px-4 py-3 font-medium text-[#022172]">
                      {config.enabled && config.field
                        ? `Grade 10${config.separator}jane.s${config.field2 ? config.separator + previewField2 : ''}`
                        : 'Grade 10'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Field values shown above are examples. Actual values come from each student&apos;s record.
            </p>
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
