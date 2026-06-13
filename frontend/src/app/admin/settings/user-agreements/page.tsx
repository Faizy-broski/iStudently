'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCampus } from '@/context/CampusContext'
import {
  getUserAgreementConfig,
  updateUserAgreementConfig,
  resetAgreementAcceptances,
  getAgreementReport,
  type AgreementRole,
  type AgreementItem,
  type AgreementReportRow,
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
  Plus, Trash2, GripVertical, Download, BarChart3, CheckCircle2, XCircle, Clock,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTranslations } from 'next-intl'

const emptyConfig = (): RoleAgreementConfig => ({
  enabled: false,
  reset_mode: 'manual',
  block_linked_students: false,
  agreements: [],
})

const newAgreementItem = (): AgreementItem => ({
  id: crypto.randomUUID(),
  title: '',
  content: '',
  enabled: true,
})

export default function UserAgreementsSettingsPage() {
  const t = useTranslations('school.user_agreements')
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null

  const ROLES: { id: AgreementRole; label: string }[] = [
    { id: 'student',   label: t('roles.student')   },
    { id: 'teacher',   label: t('roles.teacher')   },
    { id: 'parent',    label: t('roles.parent')    },
    { id: 'staff',     label: t('roles.staff')     },
    { id: 'librarian', label: t('roles.librarian') },
    { id: 'counselor', label: t('roles.counselor') },
  ]

  const [configs, setConfigs] = useState<RoleAgreementConfigs>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [resetting, setResetting] = useState<AgreementRole | null>(null)
  const [activeTab, setActiveTab] = useState<AgreementRole>('student')

  // Report state
  const [reportRows, setReportRows] = useState<AgreementReportRow[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportRole, setReportRole] = useState<AgreementRole>('student')

  const fetchReport = useCallback(async (role: AgreementRole) => {
    setReportLoading(true)
    try {
      const res = await getAgreementReport(role, campusId)
      if (res.success && res.data) setReportRows(res.data)
      else setReportRows([])
    } finally {
      setReportLoading(false)
    }
  }, [campusId])

  const handleReportRoleChange = (role: AgreementRole) => {
    setReportRole(role)
    fetchReport(role)
  }

  useEffect(() => { fetchReport('student') }, [fetchReport])

  const downloadCSV = () => {
    const headers = [t('report_name'), t('report_email'), t('report_status'), t('report_active'), t('report_date')]
    const rows = reportRows.map(r => [
      r.name,
      r.email,
      r.status === 'accepted' ? t('status_accepted') : r.status === 'rejected' ? t('status_rejected') : t('status_pending'),
      r.is_active ? t('account_active') : t('account_inactive'),
      r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '-',
    ])
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agreement-report-${reportRole}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
    ({ ...emptyConfig(), ...configs[role], agreements: configs[role]?.agreements ?? [] })

  const setRole = (role: AgreementRole, patch: Partial<RoleAgreementConfig>) => {
    setConfigs(prev => ({ ...prev, [role]: { ...emptyConfig(), ...prev[role], ...patch } }))
  }

  const addAgreement = (role: AgreementRole) => {
    const cfg = getRole(role)
    setRole(role, { agreements: [...cfg.agreements, newAgreementItem()] })
  }

  const removeAgreement = (role: AgreementRole, id: string) => {
    const cfg = getRole(role)
    setRole(role, { agreements: cfg.agreements.filter(a => a.id !== id) })
  }

  const updateAgreement = (role: AgreementRole, id: string, patch: Partial<AgreementItem>) => {
    const cfg = getRole(role)
    setRole(role, {
      agreements: cfg.agreements.map(a => a.id === id ? { ...a, ...patch } : a),
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateUserAgreementConfig(configs, campusId)
      if (res.success) {
        toast.success(t('saved'))
      } else {
        toast.error(res.error || t('save_failed'))
      }
    } catch {
      toast.error(t('unexpected_error'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (role: AgreementRole, roleLabel: string) => {
    setResetting(role)
    try {
      const res = await resetAgreementAcceptances(role)
      if (res.success) {
        toast.success(res.message || t('reset_success', { role: roleLabel }))
      } else {
        toast.error(res.error || t('reset_failed'))
      }
    } catch {
      toast.error(t('unexpected_error'))
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-linear-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t('saving') : t('save_all')}
        </Button>
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">{t('how_it_works')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>{t('info_1')}</li>
            <li>
              {t.rich('info_2', { bold: (c) => <strong>{c}</strong> })}
            </li>
            <li>
              {t.rich('info_3', {
                bold1: (c) => <strong>&quot;{c}&quot;</strong>,
                bold2: (c) => <strong>{c}</strong>,
              })}
            </li>
            <li>{t.rich('info_4', { bold: (c) => <strong>{c}</strong> })}</li>
            <li>{t('info_5')}</li>
            <li>{t.rich('info_6', { bold: (c) => <strong>{c}</strong> })}</li>
            <li>{t.rich('info_7', { bold: (c) => <strong>{c}</strong> })}</li>
            <li>{t.rich('info_8', { bold: (c) => <strong>{c}</strong> })}</li>
            {campusId && <li className="text-blue-600">{t('campus_specific')}</li>}
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
                        <CardTitle className="text-base">{t('role_agreement_title', { role: r.label })}</CardTitle>
                        <CardDescription>
                          {cfg.enabled ? t('active_desc') : t('disabled_desc')}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`enable-${r.id}`} className="text-sm">
                        {cfg.enabled ? t('enabled') : t('disabled')}
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
                  {/* Agreement documents list */}
                  {cfg.agreements.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 py-8 text-center">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{t('no_agreements')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('no_agreements_hint')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cfg.agreements.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4 ${!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          {/* Agreement header row */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {t('agreement_n', { n: idx + 1 })}
                              </span>
                              {!item.enabled && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded px-1.5 py-0.5">
                                  {t('disabled')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`item-enable-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                  {item.enabled ? t('enabled') : t('disabled')}
                                </Label>
                                <Switch
                                  id={`item-enable-${item.id}`}
                                  checked={item.enabled}
                                  onCheckedChange={v => updateAgreement(r.id, item.id, { enabled: v })}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 px-2"
                                onClick={() => removeAgreement(r.id, item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                {t('remove')}
                              </Button>
                            </div>
                          </div>

                          {/* Title + Content — dimmed when item is disabled */}
                          <div className={`space-y-4 ${!item.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="space-y-1.5">
                              <Label htmlFor={`title-${r.id}-${item.id}`}>{t('title_label')}</Label>
                              <Input
                                id={`title-${r.id}-${item.id}`}
                                value={item.title}
                                onChange={e => updateAgreement(r.id, item.id, { title: e.target.value })}
                                placeholder={t('title_placeholder')}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <Label>{t('content_label')}</Label>
                              <RichTextEditor
                                value={item.content}
                                onChange={v => updateAgreement(r.id, item.id, { content: v })}
                                campusId={campusId || undefined}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add agreement button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full"
                    disabled={!cfg.enabled}
                    onClick={() => addAgreement(r.id)}
                  >
                    <Plus className="h-4 w-4" />
                    {t('add_document')}
                  </Button>
                </CardContent>
              </Card>

              {/* ── Reset Mode ─────────────────────────────────────────────── */}
              <Card className={!cfg.enabled ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{t('reset_mode_title')}</CardTitle>
                      <CardDescription>{t('reset_mode_desc')}</CardDescription>
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
                        <span className="font-medium">{t('manual')}</span>
                        <p className="text-xs text-muted-foreground font-normal">{t('manual_desc')}</p>
                      </Label>
                    </div>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="annual" id={`reset-annual-${r.id}`} className="mt-1" />
                      <Label htmlFor={`reset-annual-${r.id}`} className="cursor-pointer space-y-0.5">
                        <span className="font-medium">{t('annual')}</span>
                        <p className="text-xs text-muted-foreground font-normal">{t('annual_desc')}</p>
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
                          <CardTitle className="text-base">{t('block_students_title')}</CardTitle>
                          <CardDescription>{t('block_students_desc')}</CardDescription>
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
                        {t('block_students_warning')}
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
                        <p className="text-sm font-medium">{t('reset_acceptances')}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('reset_all_desc', { role: r.label.toLowerCase() })}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2" disabled={resetting === r.id}>
                            {resetting === r.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <RefreshCw className="h-3 w-3" />}
                            {t('reset_acceptances')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('reset_dialog_title', { role: r.label })}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('reset_dialog_desc', { role: r.label.toLowerCase() })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleReset(r.id, r.label)}>
                              {t('reset_acceptances')}
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

      {/* ── Advanced Report ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t('report_title')}</CardTitle>
                <CardDescription>{t('report_desc', { role: ROLES.find(r => r.id === reportRole)?.label ?? reportRole })}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Role selector */}
              <div className="flex rounded-lg border overflow-hidden text-sm">
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleReportRoleChange(r.id)}
                    className={`px-3 py-1.5 transition-colors ${
                      reportRole === r.id
                        ? 'bg-[#022172] text-white'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={downloadCSV}
                disabled={reportLoading || reportRows.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                {t('download_csv')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary badges */}
          {!reportLoading && reportRows.length > 0 && (() => {
            const accepted = reportRows.filter(r => r.status === 'accepted').length
            const rejected = reportRows.filter(r => r.status === 'rejected').length
            const pending  = reportRows.filter(r => !r.status).length
            return (
              <div className="flex gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-muted">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{t('total_users')}:</span> {reportRows.length}
                </div>
                <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-medium">{t('accepted_count')}:</span> {accepted}
                </div>
                <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">{t('rejected_count')}:</span> {rejected}
                </div>
                <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-medium">{t('pending_count')}:</span> {pending}
                </div>
              </div>
            )
          })()}

          {reportLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">{t('loading_report')}</span>
            </div>
          ) : reportRows.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">{t('no_users')}</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('report_name')}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">{t('report_email')}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('report_status')}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">{t('report_active')}</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">{t('report_date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportRows.map(row => (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{row.name || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{row.email || '—'}</td>
                      <td className="px-4 py-2.5">
                        {row.status === 'accepted' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3" />{t('status_accepted')}
                          </span>
                        ) : row.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400">
                            <XCircle className="h-3 w-3" />{t('status_rejected')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" />{t('status_pending')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className={`text-xs font-medium ${row.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                          {row.is_active ? t('account_active') : t('account_inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs hidden lg:table-cell">
                        {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
