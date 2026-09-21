'use client'

import * as React from 'react'
import { LayoutGrid, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  getSchoolAllowedModules,
  updateSchoolAllowedModules,
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
  const [restricted, setRestricted] = React.useState(false)
  const [allowed, setAllowed] = React.useState<Set<string>>(new Set())

  const moduleGroups = React.useMemo(() => getModuleCatalog(), [])
  const allHrefs = React.useMemo(() => getAllCatalogHrefs(), [])

  const loadConfig = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSchoolAllowedModules(schoolId)
      if (result.success) {
        const list = result.data?.allowed_modules ?? null
        if (list) {
          setRestricted(true)
          setAllowed(new Set(list))
        } else {
          setRestricted(false)
          setAllowed(new Set(allHrefs))
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [schoolId, allHrefs])

  const handleOpen = () => {
    setOpen(true)
    loadConfig()
  }

  const setItem = (item: CatalogItem, checked: boolean) => {
    setAllowed((prev) => {
      const next = new Set(prev)
      for (const href of item.hrefs) {
        if (checked) next.add(href)
        else next.delete(href)
      }
      return next
    })
  }

  const toggleGroup = (group: CatalogGroup, checked: boolean) => {
    for (const item of group.items) setItem(item, checked)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = restricted ? Array.from(allowed) : null
      const result = await updateSchoolAllowedModules(schoolId, payload)
      if (result.success) {
        toast.success('Module access updated')
        setOpen(false)
      } else {
        toast.error(result.error ?? 'Save failed')
      }
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const itemState = (item: CatalogItem): boolean | 'indeterminate' => {
    const count = item.hrefs.filter((h) => allowed.has(h)).length
    return count === item.hrefs.length ? true : count > 0 ? 'indeterminate' : false
  }

  return (
    <>
      <Button
        size="sm"
        className="w-full gradient-blue text-white hover:shadow-md transition-all border-0 h-8"
        onClick={handleOpen}
      >
        <LayoutGrid className="h-3.5 w-3.5 me-1.5" />
        Module Access
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-8 h-8 rounded-lg gradient-blue flex items-center justify-center shrink-0">
                <LayoutGrid className="h-4 w-4 text-white" />
              </div>
              Module Access — {schoolName}
            </DialogTitle>
            <DialogDescription>
              Choose which modules and menu items this school can use. Admins can only build User
              Profiles from the modules you allow here, and unticking a module also removes it from
              the school&apos;s existing profiles. Menu items added to the app later stay hidden until
              you save this list again.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
              <p className="text-sm text-gray-400">Loading configuration...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-muted/40">
                <div>
                  <Label htmlFor="restrict-modules" className="text-sm font-medium">Restrict modules</Label>
                  <p className="text-xs text-muted-foreground">Off = everything is available, as today.</p>
                </div>
                <Switch id="restrict-modules" checked={restricted} onCheckedChange={setRestricted} />
              </div>

              {/* Native scroll container: Radix ScrollArea's viewport is h-full inside a
                  flex child with no definite height, so it grew to fit its content and
                  was clipped by overflow-hidden — the list could not be scrolled. */}
              <div className={`flex-1 min-h-0 mt-3 overflow-y-auto overscroll-contain pe-1 ${restricted ? '' : 'opacity-50 pointer-events-none'}`}>
                <div className="space-y-4 pe-3">
                  {moduleGroups.map((group) => {
                    const hrefs = group.items.flatMap((i) => i.hrefs)
                    const allChecked = hrefs.every((h) => allowed.has(h))
                    const someChecked = hrefs.some((h) => allowed.has(h))
                    return (
                      <div key={group.title} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 pb-2 mb-2 border-b">
                          <Checkbox
                            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                            onCheckedChange={(v) => toggleGroup(group, v === true)}
                          />
                          <span className="text-sm font-semibold">{label(group.title)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {group.items.map((item) => (
                            <label key={item.title} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={itemState(item)}
                                onCheckedChange={(v) => setItem(item, v === true)}
                              />
                              <span className="truncate">{label(item.title)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || saving} className="gradient-blue text-white border-0">
              {saving ? <Loader2 className="h-4 w-4 me-1.5 animate-spin" /> : <Save className="h-4 w-4 me-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
