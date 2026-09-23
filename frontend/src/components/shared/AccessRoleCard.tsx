'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  getUserRoles,
  getEntityAssignedRoleId,
  cloneRoleForEntity,
  removeEntityProfile,
  type UserProfile,
} from '@/lib/api/user-profiles'

const DEFAULT = 'default'

interface AccessRoleCardProps {
  entityType: 'student' | 'parent'
  entityId: string
  /** 'student' | 'parent' — matches user_profiles.base_role for the roles this picker offers. */
  baseRole: 'student' | 'parent'
  title: string
  description: string
  defaultLabel: string
}

/**
 * Restricts a student or parent login to a User Profile role, the same mechanism already
 * used for staff (see admin/staff/page.tsx's Edit dialog). "Default" = full, unrestricted
 * access, same as today.
 */
export function AccessRoleCard({ entityType, entityId, baseRole, title, description, defaultLabel }: AccessRoleCardProps) {
  const [roles, setRoles] = useState<UserProfile[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string>(DEFAULT)
  const [originalRoleId, setOriginalRoleId] = useState<string>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getUserRoles(), getEntityAssignedRoleId(entityType, entityId)])
      .then(([allRoles, currentRoleId]) => {
        if (cancelled) return
        setRoles(allRoles.filter((r) => r.base_role === baseRole))
        const id = currentRoleId || DEFAULT
        setSelectedRoleId(id)
        setOriginalRoleId(id)
      })
      .catch(() => { if (!cancelled) { setRoles([]); } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entityType, entityId, baseRole])

  const handleChange = async (value: string) => {
    const previous = selectedRoleId
    setSelectedRoleId(value)
    setSaving(true)
    try {
      const result = value !== DEFAULT
        ? await cloneRoleForEntity(value, entityType, entityId)
        : await removeEntityProfile(entityType, entityId)
      if (!result.success) throw new Error(result.error || 'Failed to update access role')
      setOriginalRoleId(value)
      toast.success('Access role updated')
    } catch (error) {
      setSelectedRoleId(previous)
      toast.error(error instanceof Error ? error.message : 'Failed to update access role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label className="text-xs text-muted-foreground">{description}</Label>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <Select value={selectedRoleId} onValueChange={handleChange} disabled={saving}>
            <SelectTrigger className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!loading && roles.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No {baseRole} roles exist yet — create one in Settings → User Profiles.
          </p>
        )}
        {selectedRoleId !== originalRoleId && saving && (
          <p className="text-xs text-muted-foreground">Saving…</p>
        )}
      </CardContent>
    </Card>
  )
}
