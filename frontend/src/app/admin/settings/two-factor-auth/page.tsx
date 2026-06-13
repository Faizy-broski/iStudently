'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ShieldCheck, Save, Loader2, RotateCcw } from 'lucide-react'
import {
  getAdminTwoFAConfig, updateAdminTwoFAConfig, getAdminTwoFAUsers, adminResetUserTwoFA,
  type TwoFAConfig, type TwoFAUserRow,
} from '@/lib/api/two-fa'
import { useCampus } from '@/context/CampusContext'
import { useTranslations } from 'next-intl'

const ALL_ROLES = ['admin', 'teacher', 'student', 'parent', 'staff', 'librarian']

export default function TwoFactorAuthSettingsPage() {
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null
  const t = useTranslations('twoFa')

  const [config, setConfig] = useState<TwoFAConfig>({ roles_required: [], setup_skippable: true, skip_grace_days: 1 })
  const [users, setUsers] = useState<TwoFAUserRow[]>([])
  const [configLoading, setConfigLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  useEffect(() => {
    loadConfig()
    loadUsers()
  }, [campusId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadConfig = async () => {
    setConfigLoading(true)
    const res = await getAdminTwoFAConfig(campusId)
    if (res.success && res.data) setConfig(res.data)
    setConfigLoading(false)
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    const res = await getAdminTwoFAUsers(campusId)
    if (res.success && res.data) setUsers(res.data)
    setUsersLoading(false)
  }

  const toggleRole = (role: string) => {
    setConfig(prev => ({
      ...prev,
      roles_required: prev.roles_required.includes(role)
        ? prev.roles_required.filter(r => r !== role)
        : [...prev.roles_required, role],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateAdminTwoFAConfig(config, campusId)
      if (!res.success) { toast.error(res.error ?? t('admin_save_error')); return }
      toast.success(t('admin_saved'))
    } catch {
      toast.error(t('admin_save_error'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (profileId: string) => {
    setResettingId(profileId)
    try {
      const res = await adminResetUserTwoFA(profileId)
      if (!res.success) { toast.error(res.error ?? t('admin_reset_error')); return }
      toast.success(t('admin_reset_success'))
      await loadUsers()
    } catch {
      toast.error(t('admin_reset_error'))
    } finally {
      setResettingId(null)
    }
  }

  const roleLabel = (role: string) => t(`roles.${role}` as any) || role

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-brand-blue" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin_title')}</h1>
          <p className="text-sm text-gray-500">{t('admin_desc')}</p>
        </div>
      </div>

      {/* ── Role Configuration ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin_roles_title')}</CardTitle>
          <CardDescription>{t('admin_roles_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {configLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {/* Role toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ALL_ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <Switch
                      checked={config.roles_required.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                      className="data-[state=checked]:bg-[#022172]!"
                    />
                    <span className="text-sm font-medium text-gray-700 capitalize">{roleLabel(role)}</span>
                  </label>
                ))}
              </div>

              {/* Skip settings */}
              <div className="border-t pt-4 space-y-4">
                <label className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('admin_skippable_label')}</p>
                    <p className="text-xs text-gray-500">{t('admin_skippable_desc')}</p>
                  </div>
                  <Switch
                    checked={config.setup_skippable}
                    onCheckedChange={v => setConfig(prev => ({ ...prev, setup_skippable: v }))}
                    className="data-[state=checked]:bg-brand-blue"
                  />
                </label>

                {config.setup_skippable && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-gray-600 whitespace-nowrap">{t('admin_grace_days_label')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={config.skip_grace_days}
                      onChange={e => setConfig(prev => ({ ...prev, skip_grace_days: parseInt(e.target.value) || 7 }))}
                      className="w-24 h-8 text-sm"
                    />
                    <span className="text-sm text-gray-500">{t('admin_days')}</span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 bg-linear-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {t('admin_save_btn')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Reset Section ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin_reset_section_title')}</CardTitle>
          <CardDescription>{t('admin_reset_section_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-600">{t('admin_reset_select_label')}</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder={t('admin_reset_select_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.totp_enabled).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">{t('admin_no_users')}</div>
                    ) : (
                      users.filter(u => u.totp_enabled).map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          <span className="font-medium">{u.name || u.email}</span>
                          <span className="text-xs text-gray-400 ml-1.5 capitalize">({u.role})</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={!selectedUserId || !!resettingId}
                  >
                    {resettingId ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                    {t('admin_reset_btn')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin_reset_confirm_title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('admin_reset_confirm_desc', {
                        name: users.find(u => u.id === selectedUserId)?.name
                          || users.find(u => u.id === selectedUserId)?.email
                          || '',
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleReset(selectedUserId).then(() => setSelectedUserId(''))}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {t('admin_reset_confirm_btn')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
