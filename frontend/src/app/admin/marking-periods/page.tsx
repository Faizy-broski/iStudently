"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { toast } from "sonner"
import { Plus, Save, Trash2, Loader2 } from "lucide-react"
import {
  type MarkingPeriod,
  type MarkingPeriodType,
  type GroupedMarkingPeriods,
  MP_TYPE_LABELS,
  MP_TYPE_SHORT,
  getMarkingPeriodsGrouped,
  createMarkingPeriod,
  updateMarkingPeriod,
  deleteMarkingPeriod,
} from "@/lib/api/marking-periods"

// Parent type mapping
const PARENT_TYPE: Record<MarkingPeriodType, MarkingPeriodType | null> = {
  FY: null,
  SEM: "FY",
  QTR: "SEM",
  PRO: "QTR",
}

const CHILD_TYPE: Record<MarkingPeriodType, MarkingPeriodType | null> = {
  FY: "SEM",
  SEM: "QTR",
  QTR: "PRO",
  PRO: null,
}

const MP_TYPES: MarkingPeriodType[] = ["FY", "SEM", "QTR", "PRO"]

export default function MarkingPeriodsPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [grouped, setGrouped] = useState<GroupedMarkingPeriods>({
    FY: [],
    SEM: [],
    QTR: [],
    PRO: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Currently selected marking period for editing
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Edit form state
  const [editForm, setEditForm] = useState<{
    title: string
    short_name: string
    sort_order: number
    does_grades: boolean
    does_comments: boolean
    start_date: string
    end_date: string
    post_start_date: string
    post_end_date: string
  }>({
    title: "",
    short_name: "",
    sort_order: 1,
    does_grades: true,
    does_comments: false,
    start_date: "",
    end_date: "",
    post_start_date: "",
    post_end_date: "",
  })

  // ========================================================================
  // DATA FETCHING
  // ========================================================================

  const fetchData = useCallback(async () => {
    if (!profile?.school_id) {
      setLoading(false)
      return
    }

    try {
      const data = await getMarkingPeriodsGrouped(selectedCampus?.id)
      setGrouped(data)
    } catch (error) {
      console.error("Error fetching marking periods:", error)
      toast.error("Failed to load marking periods")
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, selectedCampus?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ========================================================================
  // SELECTION & EDIT FORM
  // ========================================================================

  const selectedMP = selectedId
    ? Object.values(grouped)
        .flat()
        .find((mp) => mp.id === selectedId) || null
    : null

  // Populate form when selection changes
  useEffect(() => {
    if (selectedMP) {
      setEditForm({
        title: selectedMP.title,
        short_name: selectedMP.short_name,
        sort_order: selectedMP.sort_order,
        does_grades: selectedMP.does_grades,
        does_comments: selectedMP.does_comments,
        start_date: selectedMP.start_date || "",
        end_date: selectedMP.end_date || "",
        post_start_date: selectedMP.post_start_date || "",
        post_end_date: selectedMP.post_end_date || "",
      })
    }
  }, [selectedMP?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ========================================================================
  // ACTIONS
  // ========================================================================

  const handleAdd = async (mpType: MarkingPeriodType) => {
    const parentType = PARENT_TYPE[mpType]

    // Determine parent_id
    let parentId: string | null = null
    if (parentType) {
      const parentItems = grouped[parentType]
      if (parentItems.length === 0) {
        toast.error(`Please create a ${MP_TYPE_LABELS[parentType]} first`)
        return
      }
      // If we have a selected item that's a parent type, use it
      if (selectedMP && selectedMP.mp_type === parentType) {
        parentId = selectedMP.id
      } else {
        // Otherwise find the first parent that could be used
        // Check if there's a selected item that's a sibling - use its parent
        if (selectedMP && selectedMP.mp_type === mpType && selectedMP.parent_id) {
          parentId = selectedMP.parent_id
        } else {
          parentId = parentItems[0].id
        }
      }
    }

    const existingItems = parentId
      ? grouped[mpType].filter((mp) => mp.parent_id === parentId)
      : grouped[mpType]

    const newSortOrder =
      existingItems.length > 0
        ? Math.max(...existingItems.map((mp) => mp.sort_order)) + 1
        : 1

    try {
      const newMP = await createMarkingPeriod({
        mp_type: mpType,
        parent_id: parentId,
        title: `New ${MP_TYPE_LABELS[mpType]}`,
        short_name: `${mpType}${newSortOrder}`,
        sort_order: newSortOrder,
        does_grades: true,
        does_comments: false,
        campus_id: selectedCampus?.id || null,
      })

      toast.success(`${MP_TYPE_LABELS[mpType]} created`)
      await fetchData()
      setSelectedId(newMP.id)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create marking period")
    }
  }

  const handleSave = async () => {
    if (!selectedId || !selectedMP) return

    setSaving(true)
    try {
      await updateMarkingPeriod(selectedId, {
        title: editForm.title,
        short_name: editForm.short_name,
        sort_order: editForm.sort_order,
        does_grades: editForm.does_grades,
        does_comments: editForm.does_comments,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        post_start_date: editForm.post_start_date || null,
        post_end_date: editForm.post_end_date || null,
      })

      toast.success("Marking period saved")
      await fetchData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return

    const childType = selectedMP ? CHILD_TYPE[selectedMP.mp_type as MarkingPeriodType] : null
    const hasChildren = childType
      ? grouped[childType].some((mp) => mp.parent_id === selectedId)
      : false

    const message = hasChildren
      ? "This will also delete all child marking periods. Continue?"
      : "Delete this marking period?"

    if (!confirm(message)) return

    try {
      await deleteMarkingPeriod(selectedId)
      toast.success("Marking period deleted")
      setSelectedId(null)
      await fetchData()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    }
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /** Get items of a type that belong to the currently selected parent chain */
  const getFilteredItems = (mpType: MarkingPeriodType): MarkingPeriod[] => {
    const items = grouped[mpType]
    if (!items) return []

    const parentType = PARENT_TYPE[mpType]
    if (!parentType) return items // FY has no parent filter

    // If something in the parent column is selected, filter by that parent
    if (selectedMP) {
      // Check if selected is the direct parent type
      if (selectedMP.mp_type === parentType) {
        return items.filter((mp) => mp.parent_id === selectedMP.id)
      }
      // Check if selected is the same type — show siblings
      if (selectedMP.mp_type === mpType) {
        return items.filter((mp) => mp.parent_id === selectedMP.parent_id)
      }
      // Check if selected is a grandparent or higher — filter down
      const selectedTypeIndex = MP_TYPES.indexOf(selectedMP.mp_type as MarkingPeriodType)
      const currentTypeIndex = MP_TYPES.indexOf(mpType)
      if (selectedTypeIndex < currentTypeIndex) {
        // Walk down the hierarchy to find relevant parent
        let relevantParentIds: string[] = [selectedMP.id]
        for (let i = selectedTypeIndex + 1; i < currentTypeIndex; i++) {
          const intermediateType = MP_TYPES[i]
          const intermediateItems = grouped[intermediateType].filter((mp) =>
            relevantParentIds.includes(mp.parent_id || "")
          )
          relevantParentIds = intermediateItems.map((mp) => mp.id)
        }
        return items.filter((mp) =>
          relevantParentIds.includes(mp.parent_id || "")
        )
      }
    }

    return items
  }

  const isCurrentByDate = (mp: MarkingPeriod): boolean => {
    if (!mp.start_date || !mp.end_date) return false
    const today = new Date().toISOString().split("T")[0]
    return mp.start_date <= today && mp.end_date >= today
  }

  const formatDate = (date?: string | null): string => {
    if (!date) return ""
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  // ========================================================================
  // RENDER
  // ========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          Marking Periods
        </h1>
        <p className="text-muted-foreground">
          Define the academic calendar hierarchy
          {selectedCampus ? ` — ${selectedCampus.name}` : ""}. Full Year →
          Semesters → Quarters → Progress Periods.
        </p>
      </div>

      {/* ================================================================ */}
      {/* EDIT FORM (top section — shown when an item is selected) */}
      {/* ================================================================ */}
      {selectedMP && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#022172] dark:text-white uppercase tracking-wider">
              {MP_TYPE_LABELS[selectedMP.mp_type as MarkingPeriodType]} —{" "}
              {selectedMP.title}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                DELETE
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#008B8B] hover:bg-[#007070] text-white gap-1"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                SAVE
              </Button>
            </div>
          </div>

          {/* Row 1: Title, Short Name, Sort Order */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Title
              </label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
                className="text-[#008B8B]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Short Name
              </label>
              <Input
                value={editForm.short_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, short_name: e.target.value })
                }
                className="text-[#008B8B]"
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Sort Order
              </label>
              <Input
                type="number"
                value={editForm.sort_order}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    sort_order: parseInt(e.target.value) || 1,
                  })
                }
                className="text-[#008B8B]"
              />
            </div>
          </div>

          {/* Row 2: Graded, Comments checkboxes */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={editForm.does_grades}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, does_grades: !!checked })
                }
              />
              <span className="text-sm">Graded</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={editForm.does_comments}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, does_comments: !!checked })
                }
              />
              <span className="text-sm">Allow Comments</span>
            </label>
          </div>

          {/* Row 3: Date ranges */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Start Date
              </label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, start_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                End Date
              </label>
              <Input
                type="date"
                value={editForm.end_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, end_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Grade Posting Begins
              </label>
              <Input
                type="date"
                value={editForm.post_start_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, post_start_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Grade Posting Ends
              </label>
              <Input
                type="date"
                value={editForm.post_end_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, post_end_date: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* HIERARCHY COLUMNS (4 side-by-side tables) */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MP_TYPES.map((mpType) => {
          const items = getFilteredItems(mpType)

          return (
            <div
              key={mpType}
              className="bg-white dark:bg-gray-900 rounded-lg border flex flex-col"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                <h3 className="text-xs font-semibold text-[#022172] dark:text-white uppercase tracking-wider">
                  {MP_TYPE_SHORT[mpType]}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleAdd(mpType)}
                  title={`Add ${MP_TYPE_LABELS[mpType]}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Items List */}
              <div className="flex-1 divide-y max-h-75 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-gray-400">
                    No {MP_TYPE_SHORT[mpType].toLowerCase()} defined
                  </div>
                ) : (
                  items.map((mp) => {
                    const isSelected = selectedId === mp.id
                    const isCurrent = isCurrentByDate(mp)

                    return (
                      <button
                        key={mp.id}
                        onClick={() =>
                          setSelectedId(isSelected ? null : mp.id)
                        }
                        className={`w-full text-left px-3 py-2 transition-colors text-sm ${
                          isSelected
                            ? "bg-[#022172]/10 dark:bg-[#022172]/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate ${
                              isSelected
                                ? "font-bold text-[#022172] dark:text-white"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {mp.title}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isCurrent && (
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Currently active" />
                            )}
                            {mp.does_grades && (
                              <span className="text-[10px] text-blue-500 font-medium" title="Graded">
                                G
                              </span>
                            )}
                          </div>
                        </div>
                        {(mp.start_date || mp.end_date) && (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {formatDate(mp.start_date)} — {formatDate(mp.end_date)}
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>
          <strong>Hierarchy:</strong> Full Year → Semester → Quarter → Progress
          Period. Click <Plus className="inline h-3 w-3" /> to add, click an
          item to select & edit it above.
        </p>
        <p>
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
          Currently active (today falls within date range). <strong className="text-blue-500">G</strong> = Graded.
        </p>
      </div>
    </div>
  )
}
