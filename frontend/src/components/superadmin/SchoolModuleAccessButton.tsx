'use client'

import * as React from 'react'
import { LayoutGrid, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { getSidebarConfig, type SidebarMenuItem } from '@/config/sidebar'
import { UserRole } from '@/types'

interface SchoolModuleAccessButtonProps {
  schoolId: string
  schoolName: string
}

interface ModuleGroup {
  title: string
  items: { href: string; title: string }[]
}

// Union every assignable role's sidebar so the allow-list covers whatever an
// admin could pick from when building a User Profile for any staff/student/parent.
const ROLES_FOR_UNION: UserRole[] = ['admin', 'teacher', 'staff', 'librarian', 'student', 'parent']

function getAllModuleGroups(): ModuleGroup[] {
  const groups: ModuleGroup[] = []
  const seenHrefs = new Set<string>()

  const addItem = (groupTitle: string, item: SidebarMenuItem) => {
    if (seenHrefs.has(item.href)) return
    seenHrefs.add(item.href)
    let group = groups.find((g) => g.title === groupTitle)
    if (!group) {
      group = { title: groupTitle, items: [] }
      groups.push(group)
    }
    group.items.push({ href: item.href, title: item.title })
  }

  for (const role of ROLES_FOR_UNION) {
    for (const item of getSidebarConfig(role)) {
      if (item.isLabel || item.href === '#') continue
      if (item.subItems && item.subItems.length > 0) {
        for (const sub of item.subItems) {
          if (sub.isLabel || sub.href === '#') continue
          addItem(item.title, sub)
        }
      } else {
        addItem('__root__', item)
      }
    }
  }

  return groups
}

export function SchoolModuleAccessButton({ schoolId, schoolName }: SchoolModuleAccessButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [restricted, setRestricted] = React.useState(false)
  const [allowed, setAllowed] = React.useState<Set<string>>(new Set())

  const moduleGroups = React.useMemo(() => getAllModuleGroups(), [])
  const allHrefs = React.useMemo(() => moduleGroups.flatMap((g) => g.items.map((i) => i.href)), [moduleGroups])

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

  const toggleItem = (href: string) => {
    setAllowed((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  const toggleGroup = (group: ModuleGroup, checked: boolean) => {
    setAllowed((prev) => {
      const next = new Set(prev)
      for (const item of group.items) {
        if (checked) next.add(item.href)
        else next.delete(item.href)
      }
      return next
    })
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
              Profiles from the modules you allow here.
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

              <ScrollArea className={`flex-1 min-h-0 mt-3 ${restricted ? '' : 'opacity-50 pointer-events-none'}`}>
                <div className="space-y-4 pe-3">
                  {moduleGroups.map((group) => {
                    const allChecked = group.items.every((i) => allowed.has(i.href))
                    const someChecked = group.items.some((i) => allowed.has(i.href))
                    return (
                      <div key={group.title} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 pb-2 mb-2 border-b">
                          <Checkbox
                            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                            onCheckedChange={(v) => toggleGroup(group, v === true)}
                          />
                          <span className="text-sm font-semibold capitalize">
                            {group.title === '__root__' ? 'General' : group.title}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {group.items.map((item) => (
                            <label key={item.href} className="flex items-center gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={allowed.has(item.href)}
                                onCheckedChange={() => toggleItem(item.href)}
                              />
                              <span className="capitalize truncate">{item.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
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
