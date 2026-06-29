'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ShieldCheck, Plus, Trash2, Loader2, Users, User, Check, ChevronRight,
  Save, AlertTriangle, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  getUserRoles, getStandaloneProfiles, createUserProfile, createProfileFromRole,
  deleteUserProfile, getProfilePermissions, updateProfilePermissions, updateUserProfile,
  type UserProfile, type ProfilePermission,
} from '@/lib/api/user-profiles'
import { getSidebarConfig, type SidebarMenuItem } from '@/config/sidebar'
import { UserRole } from '@/types'

type PermMap = Record<string, { can_use: boolean; can_edit: boolean }>

const ASSIGNABLE_ROLES: UserRole[] = ['teacher', 'staff', 'librarian', 'student', 'parent']
const ROLE_LABELS: Record<string, string> = {
  teacher: 'Teacher',
  staff: 'Staff',
  librarian: 'Librarian',
  student: 'Student',
  parent: 'Parent',
}

interface ModuleGroup {
  title: string
  href: string
  items: SidebarMenuItem[]
}

function getModuleGroups(role: UserRole): ModuleGroup[] {
  const config = getSidebarConfig(role)
  const groups: ModuleGroup[] = []

  for (const item of config) {
    if (item.isLabel || item.href === '#') continue

    if (item.subItems && item.subItems.length > 0) {
      const leafItems = item.subItems.filter(
        (s) => !s.isLabel && s.href !== '#'
      )
      if (leafItems.length > 0) {
        groups.push({ title: item.title, href: item.href, items: leafItems })
      }
    } else {
      // Top-level leaf item — put it in a virtual group
      const existing = groups.find((g) => g.title === '__root__')
      if (existing) {
        existing.items.push(item)
      } else {
        groups.push({ title: '__root__', href: '#', items: [item] })
      }
    }
  }

  return groups
}

function permKey(href: string): string {
  return href
}

function buildPermMap(permissions: ProfilePermission[]): PermMap {
  const map: PermMap = {}
  for (const p of permissions) {
    map[p.module_key] = { can_use: p.can_use, can_edit: p.can_edit }
  }
  return map
}

function permMapToArray(map: PermMap): ProfilePermission[] {
  return Object.entries(map)
    .filter(([, v]) => v.can_use || v.can_edit)
    .map(([module_key, v]) => ({ module_key, can_use: v.can_use, can_edit: v.can_edit }))
}

function ListItem({
  item,
  selectedId,
  onSelect,
  onDelete,
  icon,
  badge,
}: {
  item: UserProfile
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (item: UserProfile) => void
  icon: React.ReactNode
  badge?: string
}) {
  const active = selectedId === item.id
  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
      onClick={() => onSelect(item.id)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-sm truncate">{item.name}</span>
        {item.is_system && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1">sys</Badge>
        )}
        {badge && (
          <Badge variant="outline" className={cn('text-[10px] h-4 px-1 truncate max-w-20', active && 'border-primary-foreground/40 text-primary-foreground')}>
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!item.is_system && (
          <button
            className={cn(
              'opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive transition-opacity',
              active && 'text-primary-foreground hover:text-red-200'
            )}
            onClick={(e) => { e.stopPropagation(); onDelete(item) }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronRight className={cn('h-3.5 w-3.5 opacity-40', active && 'text-primary-foreground')} />
      </div>
    </div>
  )
}

export default function UserProfilesPage() {
  const t = useTranslations('school.user_profiles')

  // Role templates (profile_type='role')
  const [roles, setRoles] = useState<UserProfile[]>([])
  // Standalone per-user profiles (profile_type='user_profile', no staff assigned)
  const [standaloneProfiles, setStandaloneProfiles] = useState<UserProfile[]>([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [permMap, setPermMap] = useState<PermMap>({})
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [loadingStandalone, setLoadingStandalone] = useState(true)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)

  // "Applies to" system role shown in the permissions panel
  const [panelRole, setPanelRole] = useState<UserRole>('teacher')

  // New Role form
  const [showAddRoleForm, setShowAddRoleForm] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [creatingRole, setCreatingRole] = useState(false)

  // New Profile form
  const [showAddProfileForm, setShowAddProfileForm] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileRoleId, setNewProfileRoleId] = useState<string>('')
  const [creatingProfile, setCreatingProfile] = useState(false)

  // Unified lookup across both lists
  const allItems = useMemo(() => [...roles, ...standaloneProfiles], [roles, standaloneProfiles])
  const selectedItem = allItems.find((p) => p.id === selectedId) ?? null
  const selectedIsRole = selectedItem?.profile_type === 'role'

  // For backward compat in the save/delete handlers
  const profiles = roles
  const selectedProfile = selectedItem

  const moduleGroups = useMemo(() => getModuleGroups(panelRole), [panelRole])

  // Group roles by base_role for display
  const rolesBySystem = useMemo(() => {
    const map: Record<string, UserProfile[]> = {}
    for (const p of roles) {
      if (!map[p.base_role]) map[p.base_role] = []
      map[p.base_role].push(p)
    }
    return map
  }, [roles])

  const fetchRoles = useCallback(async () => {
    setLoadingRoles(true)
    try {
      const data = await getUserRoles()
      setRoles(data)
    } finally {
      setLoadingRoles(false)
    }
  }, [])

  const fetchStandalone = useCallback(async () => {
    setLoadingStandalone(true)
    try {
      const data = await getStandaloneProfiles()
      setStandaloneProfiles(data)
    } finally {
      setLoadingStandalone(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
    fetchStandalone()
  }, [fetchRoles, fetchStandalone])

  const handleSelectProfile = useCallback(async (id: string) => {
    setSelectedId(id)
    setLoadingPerms(true)
    try {
      const item = [...roles, ...standaloneProfiles].find((p) => p.id === id)
      const roleForPanel = (item?.base_role ?? 'teacher') as UserRole
      setPanelRole(roleForPanel)

      const data = await getProfilePermissions(id)
      if (data.length === 0) {
        // No permissions yet — start fully checked so admin only unchecks what to restrict
        if (item) {
          const allModuleItems = getModuleGroups(roleForPanel).flatMap((g) => g.items)
          const fullMap: PermMap = {}
          for (const mi of allModuleItems) {
            fullMap[mi.href] = { can_use: true, can_edit: true }
          }
          setPermMap(fullMap)
        } else {
          setPermMap({})
        }
      } else {
        setPermMap(buildPermMap(data))
      }
    } finally {
      setLoadingPerms(false)
    }
  }, [roles, standaloneProfiles])

  const togglePerm = useCallback((href: string, field: 'can_use' | 'can_edit') => {
    const key = permKey(href)
    setPermMap((prev) => {
      const cur = prev[key] ?? { can_use: false, can_edit: false }
      const next = { ...cur, [field]: !cur[field] }
      // If can_edit is set, can_use must also be set
      if (field === 'can_edit' && next.can_edit && !next.can_use) {
        next.can_use = true
      }
      // If can_use is unset, also unset can_edit
      if (field === 'can_use' && !next.can_use && next.can_edit) {
        next.can_edit = false
      }
      return { ...prev, [key]: next }
    })
  }, [])

  const toggleGroupAll = useCallback(
    (group: ModuleGroup, field: 'can_use' | 'can_edit', value: boolean) => {
      setPermMap((prev) => {
        const updated = { ...prev }
        for (const item of group.items) {
          const key = permKey(item.href)
          const cur = updated[key] ?? { can_use: false, can_edit: false }
          const next = { ...cur, [field]: value }
          if (field === 'can_edit' && value) next.can_use = true
          if (field === 'can_use' && !value) next.can_edit = false
          updated[key] = next
        }
        return updated
      })
    },
    []
  )

  const handleSave = useCallback(async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const result = await updateProfilePermissions(selectedId, permMapToArray(permMap))
      if (result.success) {
        toast.success(t('saved'))
      } else {
        toast.error(result.error || t('save_failed'))
      }
    } finally {
      setSaving(false)
    }
  }, [selectedId, permMap, t])

  const handleCreateRole = useCallback(async () => {
    if (!newRoleName.trim()) return
    setCreatingRole(true)
    try {
      const result = await createUserProfile({ name: newRoleName.trim(), base_role: 'teacher' })
      if (result.success && result.data) {
        setRoles((prev) => [...prev, result.data!])
        setShowAddRoleForm(false)
        setNewRoleName('')
        handleSelectProfile(result.data.id)
      } else {
        toast.error(result.error || 'Failed to create role')
      }
    } finally {
      setCreatingRole(false)
    }
  }, [newRoleName, handleSelectProfile])

  const handleCreateProfile = useCallback(async () => {
    if (!newProfileName.trim() || !newProfileRoleId) return
    setCreatingProfile(true)
    try {
      const result = await createProfileFromRole(newProfileName.trim(), newProfileRoleId)
      if (result.success && result.data) {
        setStandaloneProfiles((prev) => [...prev, result.data!])
        setShowAddProfileForm(false)
        setNewProfileName('')
        setNewProfileRoleId('')
        handleSelectProfile(result.data.id)
      } else {
        toast.error(result.error || 'Failed to create profile')
      }
    } finally {
      setCreatingProfile(false)
    }
  }, [newProfileName, newProfileRoleId, handleSelectProfile])


  const handleDelete = useCallback(async (profile: UserProfile) => {
    if (profile.is_system) {
      toast.error(t('system_protected'))
      return
    }
    const result = await deleteUserProfile(profile.id)
    if (result.success) {
      if (profile.profile_type === 'role') {
        setRoles((prev) => prev.filter((p) => p.id !== profile.id))
      } else {
        setStandaloneProfiles((prev) => prev.filter((p) => p.id !== profile.id))
      }
      if (selectedId === profile.id) {
        setSelectedId(null)
        setPermMap({})
      }
      toast.success(t('delete_success'))
    } else {
      toast.error(result.error || t('delete_failed'))
    }
    setDeleteTarget(null)
  }, [selectedId, t])

  const groupAllChecked = (group: ModuleGroup, field: 'can_use' | 'can_edit') =>
    group.items.length > 0 && group.items.every((item) => permMap[permKey(item.href)]?.[field])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            Create reusable permission roles and assign them to staff members
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left panel */}
        <Card className="h-fit">
          <CardContent className="pt-4 px-3 pb-3 space-y-4">

            {/* ── ROLES section ── */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('roles_panel')}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 text-xs px-2"
                  onClick={() => { setShowAddRoleForm((v) => !v); setShowAddProfileForm(false) }}
                >
                  <Plus className="h-3 w-3" />
                  {t('new_role')}
                </Button>
              </div>

              {showAddRoleForm && (
                <div className="p-3 border rounded-lg space-y-2 bg-muted/30 mb-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('profile_name')}</Label>
                    <Input
                      placeholder={t('profile_name_placeholder')}
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleCreateRole} disabled={!newRoleName.trim() || creatingRole}>
                      {creatingRole ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      <span className="ml-1">Create</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowAddRoleForm(false); setNewRoleName('') }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {loadingRoles ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : roles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 px-2">No roles yet</p>
              ) : (
                <div className="space-y-0.5">
                  {roles.map((p) => (
                    <ListItem
                      key={p.id}
                      item={p}
                      selectedId={selectedId}
                      onSelect={handleSelectProfile}
                      onDelete={setDeleteTarget}
                      icon={<Users className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                      badge={!p.is_system ? (ROLE_LABELS[p.base_role] ?? p.base_role) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* ── PROFILES section ── */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Profiles
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 text-xs px-2"
                  onClick={() => { setShowAddProfileForm((v) => !v); setShowAddRoleForm(false) }}
                >
                  <Plus className="h-3 w-3" />
                  New Profile
                </Button>
              </div>

              {showAddProfileForm && (
                <div className="p-3 border rounded-lg space-y-2 bg-muted/30 mb-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Profile Name</Label>
                    <Input
                      placeholder="e.g. John's Profile"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Based on Role</Label>
                    <Select value={newProfileRoleId} onValueChange={setNewProfileRoleId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select a role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">
                            {r.name}
                            <span className="ml-1 text-muted-foreground">({ROLE_LABELS[r.base_role] ?? r.base_role})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleCreateProfile} disabled={!newProfileName.trim() || !newProfileRoleId || creatingProfile}>
                      {creatingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      <span className="ml-1">Create</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowAddProfileForm(false); setNewProfileName(''); setNewProfileRoleId('') }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {loadingStandalone ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : standaloneProfiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 px-2">No profiles yet</p>
              ) : (
                <div className="space-y-0.5">
                  {standaloneProfiles.map((p) => {
                    const basedOnRole = roles.find((r) => r.id === p.role_id)
                    return (
                      <ListItem key={p.id} item={p} selectedId={selectedId} onSelect={handleSelectProfile} onDelete={setDeleteTarget} icon={<User className="h-3.5 w-3.5 shrink-0 opacity-60" />} badge={basedOnRole?.name} />
                    )
                  })}
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* Right panel: permissions matrix */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('permissions_panel')}
                </CardTitle>
                {selectedProfile && (
                  <p className="text-base font-semibold mt-0.5">{selectedProfile.name}</p>
                )}
              </div>
              {selectedProfile && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {saving ? t('saving') : t('save_permissions')}
                </Button>
              )}
            </div>

            {/* "Based on" label — only shown for standalone profiles (not roles) */}
            {selectedItem && !selectedIsRole && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground shrink-0">Based on:</span>
                <Badge variant="secondary" className="text-xs font-medium">
                  {roles.find((r) => r.id === selectedItem.role_id)?.name ?? 'Unknown Role'}
                </Badge>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {!selectedProfile ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <ShieldCheck className="h-10 w-10 opacity-20" />
                <p className="text-sm">{t('select_profile_hint')}</p>
              </div>
            ) : loadingPerms ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Sticky column headers */}
                <div className="grid grid-cols-[1fr_72px_72px] items-center border-b px-6 py-2 bg-muted/40 sticky top-0 z-10">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Module</span>
                  <span className="text-xs font-semibold text-center uppercase tracking-wide text-muted-foreground">{t('can_use')}</span>
                  <span className="text-xs font-semibold text-center uppercase tracking-wide text-muted-foreground">{t('can_edit')}</span>
                </div>

                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-0">
                    {moduleGroups.map((group, gi) => {
                      const useAll = groupAllChecked(group, 'can_use')
                      const editAll = groupAllChecked(group, 'can_edit')

                      return (
                        <div key={`${group.href}-${gi}`}>
                          {/* Group header row */}
                          <div className="grid grid-cols-[1fr_72px_72px] items-center px-6 py-2 bg-muted/20 border-b">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {group.title === '__root__' ? 'General' : group.title.replace(/_/g, ' ')}
                            </span>
                            <div className="flex flex-col items-center gap-0.5">
                              <Checkbox
                                checked={useAll}
                                onCheckedChange={(checked) => toggleGroupAll(group, 'can_use', !!checked)}
                                className="h-4 w-4"
                              />
                              <span className="text-[10px] text-muted-foreground">{t('check_all')}</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <Checkbox
                                checked={editAll}
                                onCheckedChange={(checked) => toggleGroupAll(group, 'can_edit', !!checked)}
                                className="h-4 w-4"
                              />
                              <span className="text-[10px] text-muted-foreground">{t('check_all')}</span>
                            </div>
                          </div>

                          {/* Item rows */}
                          <div className="divide-y">
                            {group.items.map((item) => {
                              const key = permKey(item.href)
                              const perm = permMap[key] ?? { can_use: false, can_edit: false }
                              return (
                                <div
                                  key={item.href}
                                  className="grid grid-cols-[1fr_72px_72px] items-center px-6 py-2.5 hover:bg-muted/20 transition-colors border-b last:border-b-0"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="text-sm capitalize truncate">
                                      {item.title.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={perm.can_use}
                                      onCheckedChange={() => togglePerm(item.href, 'can_use')}
                                    />
                                  </div>
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={perm.can_edit}
                                      onCheckedChange={() => togglePerm(item.href, 'can_edit')}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Profile
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_confirm')} <strong>{deleteTarget?.name}</strong>
              <br />
              Staff members assigned this profile will revert to full default access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
