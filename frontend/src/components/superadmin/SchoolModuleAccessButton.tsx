'use client'

import * as React from 'react'
import { LayoutGrid, Loader2, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  getSchoolAllowedModules,
  getSchoolDeniedModules,
  updateSchoolDeniedModules,
} from '@/lib/api/school-settings'
import { getModuleCatalog, getAllCatalogHrefs, type CatalogGroup, type CatalogItem } from '@/config/moduleCatalog'
import { useSidebarLabel } from '@/hooks/useSidebarLabel'

interface SchoolModuleAccessButtonProps {
  schoolId: string
  schoolName: string
}

export function SchoolModuleAccessButton({ schoolId, schoolName }: SchoolModuleAccessButtonProps) {
  const label = useSidebarLabel()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [migrating, setMigrating] = React.useState(false)
  // restricted = the switch is ON (some modules are hidden)
  const [restricted, setRestricted] = React.useState(false)
  // denied = set of hrefs that are HIDDEN for this school
  const [denied, setDenied] = React.useState<Set<string>>(new Set())

  const moduleGroups = React.useMemo(() => getModuleCatalog(), [])
  const allHrefs = React.useMemo(() => getAllCatalogHrefs(), [])

  const loadConfig = React.useCallback(async () => {
    setLoading(true)
    try {
      const deniedResult = await getSchoolDeniedModules(schoolId)
      if (!deniedResult.success) return

      const deniedList = deniedResult.data?.denied_modules  // null = not yet migrated

      if (deniedList === null || deniedList === undefined) {
        // One-time migration: school still has allow-list semantics.
        // Compute denied = full catalog − allowed.
        const allowedResult = await getSchoolAllowedModules(schoolId)
        const allowedList = allowedResult.data?.allowed_modules ?? null
        if (allowedList) {
          const allowedSet = new Set(allowedList)
          const computedDenied = allHrefs.filter((h) => !allowedSet.has(h))
          await updateSchoolDeniedModules(schoolId, computedDenied)
          setDenied(new Set(computedDenied))
          setRestricted(computedDenied.length > 0)
        } else {
          // Was already unrestricted — write an empty denied list to mark migration done
          await updateSchoolDeniedModules(schoolId, [])
          setDenied(new Set())
          setRestricted(false)
        }
      } else {
        setDenied(new Set(deniedList))
        setRestricted(deniedList.length > 0)
      }
    } catch {
      // silent — user can retry by reopening
    } finally {
      setLoading(false)
    }
  }, [schoolId, allHrefs])

  React.useEffect(() => {
    if (open) loadConfig()
  }, [open, loadConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = restricted ? Array.from(denied) : null
      const result = await updateSchoolDeniedModules(schoolId, payload)
      if (result.success) {
        toast.success('Module visibility saved')
        setOpen(false)
      } else {
        toast.error('Failed to save')
      }
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  /** Tri-state for a catalog item that covers multiple hrefs. */
  const itemState = (item: CatalogItem): boolean | 'indeterminate' => {
    // visible (not denied) = checked. hidden (denied) = unchecked.
    const visibleCount = item.hrefs.filter((h) => !denied.has(h)).length
    if (visibleCount === item.hrefs.length) return true          // all visible
    if (visibleCount === 0) return false                         // all hidden
    return 'indeterminate'                                       // mixed
  }

  const toggleItem = (item: CatalogItem) => {
    const allVisible = item.hrefs.every((h) => !denied.has(h))
    setDenied((prev) => {
      const next = new Set(prev)
      if (allVisible) {
        // Hide all hrefs of this item
        for (const h of item.hrefs) next.add(h)
      } else {
        // Show all hrefs of this item (remove from denied)
        for (const h of item.hrefs) next.delete(h)
      }
      return next
    })
  }

  const handleRestrictedToggle = (checked: boolean) => {
    setRestricted(checked)
    if (!checked) {
      // Turning off the restrict switch — clear all denials
      setDenied(new Set())
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon" title="Module Access" onClick={() => setOpen(true)}>
        <LayoutGrid className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Module Access — {schoolName}</DialogTitle>
            <DialogDescription>
              Control which modules are visible to this school. Hidden modules are removed from
              every user's sidebar. New modules added to the app are visible by default.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="restrict-switch"
                  checked={restricted}
                  onCheckedChange={handleRestrictedToggle}
                />
                <Label htmlFor="restrict-switch">
                  Hide specific modules for this school
                </Label>
              </div>

              {restricted && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Checked = visible. Uncheck to hide a module.
                  </p>
                  {moduleGroups.map((group) => (
                    <div key={group.title}>
                      {group.title !== '__root__' && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          {label(group.title)}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-1">
                        {group.items.map((item) => {
                          const state = itemState(item)
                          return (
                            <div key={item.title} className="flex items-center gap-2">
                              <Checkbox
                                id={`item-${item.title}`}
                                checked={state}
                                onCheckedChange={() => toggleItem(item)}
                              />
                              <Label htmlFor={`item-${item.title}`} className="text-sm font-normal cursor-pointer">
                                {label(item.title)}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
