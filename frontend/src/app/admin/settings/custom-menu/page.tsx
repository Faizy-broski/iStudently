'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GripVertical, Save, RotateCcw, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useCampus } from '@/context/CampusContext'
import { getCustomMenuOrder, updateCustomMenuOrder } from '@/lib/api/custom-menu'
import { getSidebarConfig } from '@/config/sidebar'
import type { SidebarMenuItem } from '@/config/sidebar'
import type { UserRole } from '@/types'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EditableRole = 'admin' | 'teacher' | 'student' | 'parent' | 'librarian'

const EDITABLE_ROLES: { value: EditableRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'librarian', label: 'Librarian' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Sortable item component
// ─────────────────────────────────────────────────────────────────────────────

function SortableSection({ id, title, icon: Icon }: { id: string; title: string; icon: React.ComponentType<{ className?: string }> }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-[#022172]/30' : 'shadow-sm'
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <Icon className="h-5 w-5 text-[#022172]" />
      <span className="text-sm font-medium text-gray-700">{title}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomMenuPage() {
  const campusCtx = useCampus()
  const selectedCampus = campusCtx?.selectedCampus ?? null
  const campusId = selectedCampus?.id ?? null

  const [activeRole, setActiveRole] = useState<EditableRole>('admin')
  const [savedOrder, setSavedOrder] = useState<Record<string, string[]>>({})
  const [currentOrder, setCurrentOrder] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Get the default section titles for a role
  const getDefaultOrder = useCallback((role: UserRole): string[] => {
    const items = getSidebarConfig(role)
    return items.map((item) => item.title)
  }, [])

  // Resolve the effective order: saved order with any new sections appended
  const resolveOrder = useCallback(
    (role: EditableRole, saved: Record<string, string[]>): string[] => {
      const defaults = getDefaultOrder(role)
      const customOrder = saved[role]
      if (!customOrder || customOrder.length === 0) return defaults

      // Start with saved order, filter to only titles that still exist
      const defaultSet = new Set(defaults)
      const ordered = customOrder.filter((t) => defaultSet.has(t))
      // Append any new sections not in the saved order
      const orderedSet = new Set(ordered)
      for (const t of defaults) {
        if (!orderedSet.has(t)) ordered.push(t)
      }
      return ordered
    },
    [getDefaultOrder],
  )

  // Fetch saved order
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCustomMenuOrder(campusId).then((res) => {
      if (cancelled) return
      const data = res.data ?? {}
      setSavedOrder(data)
      setCurrentOrder(resolveOrder(activeRole, data))
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [campusId]) // eslint-disable-line react-hooks/exhaustive-deps

  // When switching roles, resolve current order from saved data
  useEffect(() => {
    setCurrentOrder(resolveOrder(activeRole, savedOrder))
  }, [activeRole, savedOrder, resolveOrder])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setCurrentOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string)
      const newIndex = prev.indexOf(over.id as string)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateCustomMenuOrder(activeRole, currentOrder, campusId)
      if (res.success) {
        setSavedOrder(res.data ?? { ...savedOrder, [activeRole]: currentOrder })
        toast.success('Menu order saved')
      } else {
        toast.error(res.error || 'Failed to save')
      }
    } catch {
      toast.error('Failed to save menu order')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setCurrentOrder(getDefaultOrder(activeRole))
  }

  // Build a map of title → icon for the current role
  const sectionMeta = useCallback(
    (role: UserRole): Map<string, SidebarMenuItem> => {
      const items = getSidebarConfig(role)
      const map = new Map<string, SidebarMenuItem>()
      for (const item of items) map.set(item.title, item)
      return map
    },
    [],
  )

  const meta = sectionMeta(activeRole)

  const isDirty =
    JSON.stringify(currentOrder) !==
    JSON.stringify(resolveOrder(activeRole, savedOrder))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom Menu</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drag and drop to reorder the sidebar sections for each role.
          {selectedCampus && (
            <span className="ml-1 font-medium text-[#022172]">
              Campus: {selectedCampus.name}
            </span>
          )}
        </p>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How It Works</p>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-700">
              <li>Reorder the top-level sidebar sections for any role</li>
              <li>Each campus can have its own menu order</li>
              <li>New sections added by plugins will appear at the bottom</li>
              <li>Use <strong>Reset to Default</strong> to restore the original order</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sidebar Section Order</CardTitle>
          <CardDescription>
            Select a role and drag sections to reorder them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeRole}
            onValueChange={(v) => setActiveRole(v as EditableRole)}
          >
            <TabsList className="mb-4">
              {EDITABLE_ROLES.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {EDITABLE_ROLES.map((r) => (
              <TabsContent key={r.value} value={r.value}>
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    Loading…
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={currentOrder}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {currentOrder.map((title) => {
                          const item = meta.get(title)
                          return (
                            <SortableSection
                              key={title}
                              id={title}
                              title={title}
                              icon={item?.icon ?? GripVertical}
                            />
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save Order'}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
