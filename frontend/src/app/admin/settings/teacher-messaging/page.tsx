'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { messagingApi, type TeacherAllowedStaffOption } from '@/lib/api/messaging'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Info, Save, Loader2, MessageSquare, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function TeacherMessagingSettingsPage() {
  const campusContext = useCampus()
  const selectedCampusId = campusContext?.selectedCampus?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState<TeacherAllowedStaffOption[]>([])
  const [allowedIds, setAllowedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const result = await messagingApi.getTeacherAllowedStaff(selectedCampusId)
      if (result.success && result.data) {
        setStaff(result.data)
        setAllowedIds(new Set(result.data.filter((s) => s.isAllowed).map((s) => s.profileId)))
      } else {
        toast.error(result.error || 'Failed to load staff list')
      }
    } catch {
      toast.error('Failed to load staff list')
    }
    setLoading(false)
  }, [selectedCampusId])

  useEffect(() => { void fetchStaff() }, [fetchStaff])

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return staff
    return staff.filter((s) => s.name.toLowerCase().includes(term) || s.role.toLowerCase().includes(term))
  }, [staff, search])

  const toggle = (profileId: string) => {
    setAllowedIds((prev) => {
      const next = new Set(prev)
      next.has(profileId) ? next.delete(profileId) : next.add(profileId)
      return next
    })
  }

  const allVisibleSelected = filteredStaff.length > 0 && filteredStaff.every((s) => allowedIds.has(s.profileId))
  const toggleSelectAllVisible = () => {
    setAllowedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const s of filteredStaff) next.delete(s.profileId)
      } else {
        for (const s of filteredStaff) next.add(s.profileId)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await messagingApi.setTeacherAllowedStaff(Array.from(allowedIds), selectedCampusId)
      if (result.success) {
        toast.success('Teacher messaging permissions saved')
      } else {
        toast.error(result.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save')
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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Teacher Messaging Permissions
          </h1>
          <p className="text-muted-foreground">
            Choose which staff members teachers are allowed to message
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">How it works</p>
          <p className="mt-1">
            From <strong>Messaging → Write</strong>, teachers can only message: students enrolled in
            their own classes, every school admin (always allowed, not shown below), and whichever
            staff members you check here. Teachers cannot message other teachers or parents. This is
            enforced on the server, not just hidden in the UI.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Staff</CardTitle>
              <CardDescription>
                {allowedIds.size} of {staff.length} staff approved
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No non-teacher, non-admin staff found for this campus yet.
            </div>
          ) : (
            <div className="rounded-md border divide-y max-h-[28rem] overflow-auto">
              <div
                className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/40 bg-muted/20"
                onClick={toggleSelectAllVisible}
              >
                <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} onClick={(e) => e.stopPropagation()} />
                <div className="text-sm font-medium">
                  Select all {filteredStaff.length} result{filteredStaff.length !== 1 ? 's' : ''}
                </div>
              </div>
              {filteredStaff.map((s) => {
                const isAllowed = allowedIds.has(s.profileId)
                return (
                  <div
                    key={s.profileId}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${isAllowed ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                    onClick={() => toggle(s.profileId)}
                  >
                    <Checkbox checked={isAllowed} onCheckedChange={() => toggle(s.profileId)} onClick={(e) => e.stopPropagation()} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name || 'Unnamed'}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.title || s.role}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white px-8"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Permissions
        </Button>
      </div>
    </div>
  )
}
