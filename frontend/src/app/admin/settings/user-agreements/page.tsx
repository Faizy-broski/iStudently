'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCampus } from '@/context/CampusContext'
import {
  getUserAgreementConfig,
  updateUserAgreementConfig,
  resetAgreementAcceptances,
  type AgreementRole,
  type RoleAgreementConfigs,
  type RoleAgreementConfig,
} from '@/lib/api/user-agreement'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import {
  FileText, Save, Loader2, Info, RefreshCw, CalendarClock, ToggleRight, Users,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const ROLES: { id: AgreementRole; label: string }[] = [
  { id: 'student',   label: 'Students'   },
  { id: 'teacher',   label: 'Teachers'   },
  { id: 'parent',    label: 'Parents'    },
  { id: 'staff',     label: 'Staff'      },
  { id: 'librarian', label: 'Librarians' },
  { id: 'counselor', label: 'Counselors' },
]

const emptyConfig = (): RoleAgreementConfig => ({
  title: '',
  content: '',
  enabled: false,
  reset_mode: 'manual',
  block_linked_students: false,
})

export default function UserAgreementsSettingsPage() {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null

  const [configs, setConfigs] = useState<RoleAgreementConfigs>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [resetting, setResetting] = useState<AgreementRole | null>(null)
  const [activeTab, setActiveTab] = useState<AgreementRole>('student')

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUserAgreementConfig(campusId)
      if (res.success && res.data) setConfigs(res.data)
    } finally {
      setLoading(false)
    }
  }, [campusId])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const getRole = (role: AgreementRole): RoleAgreementConfig =>
    ({ ...emptyConfig(), ...configs[role] })

  const setRole = (role: AgreementRole, patch: Partial<RoleAgreementConfig>) => {
    setConfigs(prev => ({ ...prev, [role]: { ...emptyConfig(), ...prev[role], ...patch } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateUserAgreementConfig(configs, campusId)
      if (res.success) {
        toast.success('Agreement configurations saved')
      } else {
        toast.error(res.error || 'Failed to save')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (role: AgreementRole) => {
    setResetting(role)
    try {
      const res = await resetAgreementAcceptances(role)
      if (res.success) {
        toast.success(res.message || `All ${role} acceptances reset`)
      } else {
        toast.error(res.error || 'Failed to reset')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setResetting(null)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Agreements</h1>
            <p className="text-sm text-muted-foreground">
              Configure agreements users must accept on first login
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-brand-blue hover:bg-brand-blue/90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All
        </Button>
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">How It Works</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Enable an agreement for any role — a full-screen popup appears on first login.</li>
            <li>Users must tick <strong>"I have read the agreement"</strong> then click <strong>Accept</strong> to proceed.</li>
            <li>Clicking <strong>Reject</strong> immediately deactivates the account and signs them out.</li>
            <li>A rejected user can visit <code>/agreement/reactivate</code>, enter their email, and restore access.</li>
            <li><strong>Manual reset:</strong> accepted once, stays accepted. Use <em>Reset Acceptances</em> to force re-acceptance.</li>
            <li><strong>Annual reset:</strong> acceptance is tied to the current academic year and resets automatically each year.</li>
            <li><strong>Block students (parent only):</strong> students with linked parents cannot access the system until their parent accepts.</li>
            {campusId && <li className="text-blue-600">These configs are campus-specific for the selected campus.</li>}
          </ul>
        </CardContent>
      </Card>

      {/* Tabs per role */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as AgreementRole)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {ROLES.map(r => (
            <TabsTrigger key={r.id} value={r.id}>
              {r.label}
              {getRole(r.id).enabled && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {ROLES.map(r => {
          const cfg = getRole(r.id)
          const isParent = r.id === 'parent'

          return (
            <TabsContent key={r.id} value={r.id} className="mt-4 space-y-4">

              {/* ── Enable / disable ───────────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ToggleRight className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base">{r.label} Agreement</CardTitle>
                        <CardDescription>
                          {cfg.enabled
                            ? 'Active — users will see this popup on first login.'
                            : 'Disabled — no popup shown for this role.'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`enable-${r.id}`} className="text-sm">
                        {cfg.enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                      <Switch
                        id={`enable-${r.id}`}
                        checked={cfg.enabled}
                        onCheckedChange={v => setRole(r.id, { enabled: v })}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor={`title-${r.id}`}>Agreement Title</Label>
                    <Input
                      id={`title-${r.id}`}
                      value={cfg.title}
                      onChange={e => setRole(r.id, { title: e.target.value })}
                      placeholder="e.g. School Policies & Terms of Use"
                      disabled={!cfg.enabled}
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <Label>Agreement Content</Label>
                    <div className={!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}>
                      <RichTextEditor
                        value={cfg.content}
                        onChange={v => setRole(r.id, { content: v })}
                        campusId={campusId || undefined}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Reset Mode ─────────────────────────────────────────────── */}
              <Card className={!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">Reset Mode</CardTitle>
                      <CardDescription>
                        When should users be asked to accept again?
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={cfg.reset_mode ?? 'manual'}
                    onValueChange={v => setRole(r.id, { reset_mode: v as 'manual' | 'annual' })}
                    className="space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="manual" id={`reset-manual-${r.id}`} className="mt-1" />
                      <Label htmlFor={`reset-manual-${r.id}`} className="cursor-pointer space-y-0.5">
                        <span className="font-medium">Manual</span>
                        <p className="text-xs text-muted-foreground font-normal">
                          Once accepted, stays accepted indefinitely. Use "Reset Acceptances" below to force everyone to re-accept (e.g. after updating the agreement text).
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="annual" id={`reset-annual-${r.id}`} className="mt-1" />
                      <Label htmlFor={`reset-annual-${r.id}`} className="cursor-pointer space-y-0.5">
                        <span className="font-medium">Annual</span>
                        <p className="text-xs text-muted-foreground font-normal">
                          Acceptance is tied to the current academic year. When a new year becomes current, users must accept again automatically — no manual reset needed.
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* ── Block linked students (parent role only) ───────────────── */}
              {isParent && (
                <Card className={!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-base">Block Linked Students</CardTitle>
                          <CardDescription>
                            When enabled, students whose parent has not yet accepted this agreement cannot access the system.
                            Students with no linked parent are always allowed in.
                          </CardDescription>
                        </div>
                      </div>
                      <Switch
                        id="block-students"
                        checked={cfg.block_linked_students ?? false}
                        onCheckedChange={v => setRole(r.id, { block_linked_students: v })}
                        disabled={!cfg.enabled}
                      />
                    </div>
                  </CardHeader>
                  {cfg.block_linked_students && (
                    <CardContent>
                      <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                        Students will see a "Access Restricted" screen until their parent logs in and accepts the agreement.
                        The agreement popup will also list the student names the parent is accepting on behalf of.
                      </p>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* ── Reset acceptances ──────────────────────────────────────── */}
              {cfg.enabled && (
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Reset Acceptances</p>
                        <p className="text-xs text-muted-foreground">
                          All {r.label.toLowerCase()} who already accepted will see the popup again on next login.
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2" disabled={resetting === r.id}>
                            {resetting === r.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <RefreshCw className="h-3 w-3" />}
                            Reset Acceptances
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset {r.label} Acceptances?</AlertDialogTitle>
                            <AlertDialogDescription>
                              All {r.label.toLowerCase()} who previously accepted will be required to accept again on their next login. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleReset(r.id)}>
                              Reset Acceptances
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              )}

            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
