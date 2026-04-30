'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Minus, Save, Globe, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCampus } from '@/context/CampusContext'
import * as embeddedApi from '@/lib/api/embedded-resources'
import * as academicsApi from '@/lib/api/academics'

// ── Types ──────────────────────────────────────────────────────────────────

interface RowState {
  id: string | 'new'
  title: string
  url: string
  published_grade_ids: string[]
  dirty: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isValidUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function EmbeddedResourcesPage() {
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [rows, setRows] = useState<RowState[]>([])
  const [grades, setGrades] = useState<academicsApi.GradeLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!selectedCampus) return
    setLoading(true)
    const [resourcesRes, gradesRes] = await Promise.all([
      embeddedApi.getEmbeddedResources(selectedCampus.id),
      academicsApi.getGradeLevels(selectedCampus.id),
    ])

    if (resourcesRes.success && resourcesRes.data) {
      setRows(
        resourcesRes.data.map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          published_grade_ids: r.published_grade_ids || [],
          dirty: false,
        }))
      )
    } else {
      toast.error(resourcesRes.error || 'Failed to load embedded resources')
    }

    if (gradesRes.success && gradesRes.data) {
      setGrades([...gradesRes.data].sort((a, b) => a.order_index - b.order_index))
    }
    setLoading(false)
  }, [selectedCampus])

  useEffect(() => {
    if (selectedCampus) fetchData()
  }, [selectedCampus, fetchData])

  // ── Row mutations ─────────────────────────────────────────────────────────

  const updateRow = (id: string | 'new', patch: Partial<Omit<RowState, 'id'>>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r))
    )
  }

  const addNewRow = () => {
    if (rows.some((r) => r.id === 'new')) return
    setRows((prev) => [
      ...prev,
      { id: 'new', title: '', url: '', published_grade_ids: [], dirty: true },
    ])
  }

  const toggleGrade = (rowId: string | 'new', gradeId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const ids = r.published_grade_ids.includes(gradeId)
          ? r.published_grade_ids.filter((g) => g !== gradeId)
          : [...r.published_grade_ids, gradeId]
        return { ...r, published_grade_ids: ids, dirty: true }
      })
    )
  }

  // ── Save all dirty rows ────────────────────────────────────────────────────

  const saveAll = async () => {
    const dirtyRows = rows.filter((r) => r.dirty)
    if (dirtyRows.length === 0) {
      toast.info('No changes to save')
      return
    }

    // Validate existing rows (not new)
    for (const r of dirtyRows) {
      if (r.id !== 'new') {
        if (!r.title.trim()) { toast.error('Title cannot be empty'); return }
        if (!r.url.trim() || !isValidUrl(r.url)) { toast.error(`Invalid URL: ${r.url}`); return }
      }
    }

    setSaving(true)
    let hadError = false

    for (const r of dirtyRows) {
      if (r.id === 'new') {
        if (!r.title.trim() || !r.url.trim()) continue // skip blank new row
        if (!isValidUrl(r.url)) { toast.error(`Invalid URL: ${r.url}`); hadError = true; continue }
        const res = await embeddedApi.createEmbeddedResource({
          title: r.title,
          url: r.url,
          published_grade_ids: r.published_grade_ids,
          campus_id: selectedCampus?.id,
        })
        if (!res.success) { toast.error(res.error || 'Failed to create resource'); hadError = true }
      } else {
        const res = await embeddedApi.updateEmbeddedResource(r.id, {
          title: r.title,
          url: r.url,
          published_grade_ids: r.published_grade_ids,
        }, selectedCampus?.id)
        if (!res.success) { toast.error(res.error || 'Failed to update resource'); hadError = true }
      }
    }

    setSaving(false)
    if (!hadError) toast.success('Saved successfully')
    await fetchData()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const res = await embeddedApi.deleteEmbeddedResource(deleteTarget, selectedCampus?.id)
    if (res.success) {
      toast.success('Resource deleted')
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget))
    } else {
      toast.error(res.error || 'Failed to delete resource')
    }
    setDeleteTarget(null)
  }

  const removeNewRow = () => {
    setRows((prev) => prev.filter((r) => r.id !== 'new'))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Globe className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Embedded Resources</h1>
            <p className="text-sm text-gray-500">
              Add external websites that appear in the Resources menu for all users
            </p>
          </div>
        </div>
        <Button onClick={saveAll} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      {/* Note banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <strong>Note:</strong> Links added here will appear under the <em>Resources</em> menu for
        Administrators, Teachers, Parents, and Students. You can optionally limit access by grade
        level. Some websites may block embedding for security reasons.
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 text-left font-semibold text-blue-600 uppercase text-xs tracking-wide w-48">
                  Title
                </th>
                <th className="px-4 py-3 text-left font-semibold text-blue-600 uppercase text-xs tracking-wide">
                  Link
                </th>
                <th className="px-4 py-3 text-left font-semibold text-blue-600 uppercase text-xs tracking-wide w-80">
                  Limit to Grade Levels
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {/* Delete / Remove button */}
                  <td className="px-4 py-3">
                    {row.id === 'new' ? (
                      <button
                        onClick={removeNewRow}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors text-lg font-bold"
                        title="Cancel"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setDeleteTarget(row.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        title="Delete"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <Input
                      value={row.title}
                      onChange={(e) => updateRow(row.id, { title: e.target.value })}
                      placeholder="Title"
                      maxLength={30}
                      className="h-8 text-sm"
                      required={row.id !== 'new'}
                    />
                  </td>

                  {/* URL */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.url && row.id !== 'new' && (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Link
                        </a>
                      )}
                      <Input
                        value={row.url}
                        onChange={(e) => updateRow(row.id, { url: e.target.value })}
                        placeholder="https://example.com"
                        className="h-8 text-sm flex-1"
                      />
                    </div>
                  </td>

                  {/* Grade Levels multi-select */}
                  <td className="px-4 py-3">
                    <GradePicker
                      grades={grades}
                      selected={row.published_grade_ids}
                      onToggle={(gid) => toggleGrade(row.id, gid)}
                    />
                  </td>
                </tr>
              ))}

              {/* Add row */}
              {!rows.some((r) => r.id === 'new') && (
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={addNewRow}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      title="Add new resource"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-400 italic">
                    Click + to add a new embedded resource
                  </td>
                </tr>
              )}

              {rows.length === 0 && !rows.some((r) => r.id === 'new') && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400">
                    No embedded resources yet. Click + to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Save */}
      <div className="flex justify-center">
        <Button onClick={saveAll} disabled={saving} size="lg" className="gap-2 px-10">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Embedded Resource</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the resource and its link from the Resources menu for all
              users. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Grade Picker ───────────────────────────────────────────────────────────

interface GradePickerProps {
  grades: academicsApi.GradeLevel[]
  selected: string[]
  onToggle: (id: string) => void
}

function GradePicker({ grades, selected, onToggle }: GradePickerProps) {
  if (grades.length === 0) {
    return <span className="text-xs text-gray-400">No grades configured</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {grades.map((g) => {
        const active = selected.includes(g.id)
        return (
          <button
            key={g.id}
            onClick={() => onToggle(g.id)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              active
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {active && (
              <span className="text-xs leading-none">&times;</span>
            )}
            {g.name}
          </button>
        )
      })}
      {selected.length === 0 && (
        <span className="text-xs text-gray-400 italic">All grades (no restriction)</span>
      )}
    </div>
  )
}
