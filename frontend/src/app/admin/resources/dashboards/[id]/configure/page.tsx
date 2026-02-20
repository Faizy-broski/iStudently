'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  Minus,
  Save,
  Loader2,
  ExternalLink,
  LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as dashboardsApi from '@/lib/api/dashboards'

interface ElementFormState {
  url: string
  title: string
  sort_order: string
  width_percent: string
  height_px: string
  refresh_minutes: string
  custom_css: string
}

const emptyForm: ElementFormState = {
  url: '',
  title: '',
  sort_order: '',
  width_percent: '100',
  height_px: '400',
  refresh_minutes: '',
  custom_css: '',
}

export default function DashboardConfigurePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dashboardId } = use(params)
  useAuth()
  const router = useRouter()

  const [newElement, setNewElement] = useState<ElementFormState>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; element: dashboardsApi.DashboardElement | null }>({
    open: false,
    element: null,
  })
  const [deleting, setDeleting] = useState(false)
  const [editingElements, setEditingElements] = useState<Map<string, Partial<ElementFormState>>>(new Map())
  const [savingElements, setSavingElements] = useState<Set<string>>(new Set())

  const cacheKey = ['dashboard-detail', dashboardId]

  const { data: dashboard, isLoading } = useSWR(
    dashboardId ? cacheKey : null,
    () => dashboardsApi.getDashboardById(dashboardId),
    { revalidateOnFocus: false }
  )

  const elements = dashboard?.elements || []

  // Track edits for each element
  const getEditValue = (elementId: string, field: keyof ElementFormState, original: string) => {
    const edits = editingElements.get(elementId)
    if (edits && field in edits) return edits[field] || ''
    return original
  }

  const setEditValue = (elementId: string, field: keyof ElementFormState, value: string) => {
    setEditingElements((prev) => {
      const next = new Map(prev)
      const edits = next.get(elementId) || {}
      next.set(elementId, { ...edits, [field]: value })
      return next
    })
  }

  const handleAddElement = async () => {
    if (!newElement.url.trim()) {
      toast.error('URL is required')
      return
    }
    setSaving(true)
    try {
      const result = await dashboardsApi.addElement(dashboardId, {
        url: newElement.url.trim(),
        title: newElement.title.trim() || undefined,
        sort_order: newElement.sort_order ? parseInt(newElement.sort_order) : undefined,
        width_percent: parseInt(newElement.width_percent) || 100,
        height_px: parseInt(newElement.height_px) || 400,
        refresh_minutes: newElement.refresh_minutes ? parseInt(newElement.refresh_minutes) : undefined,
        custom_css: newElement.custom_css.trim() || undefined,
      })
      if (result) {
        toast.success('Element added!')
        setNewElement({ ...emptyForm })
        mutate(cacheKey)
      } else {
        toast.error('Failed to add element')
      }
    } catch {
      toast.error('Failed to add element')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveElement = async (element: dashboardsApi.DashboardElement) => {
    const edits = editingElements.get(element.id)
    if (!edits || Object.keys(edits).length === 0) return

    setSavingElements((prev) => new Set([...prev, element.id]))
    try {
      const updateData: Record<string, unknown> = {}
      if (edits.url !== undefined) updateData.url = edits.url
      if (edits.title !== undefined) updateData.title = edits.title
      if (edits.sort_order !== undefined) updateData.sort_order = edits.sort_order ? parseInt(edits.sort_order) : null
      if (edits.width_percent !== undefined) updateData.width_percent = parseInt(edits.width_percent) || 100
      if (edits.height_px !== undefined) updateData.height_px = parseInt(edits.height_px) || 400
      if (edits.refresh_minutes !== undefined) updateData.refresh_minutes = edits.refresh_minutes ? parseInt(edits.refresh_minutes) : null
      if (edits.custom_css !== undefined) updateData.custom_css = edits.custom_css || null

      const result = await dashboardsApi.updateElement(dashboardId, element.id, updateData)
      if (result) {
        toast.success('Element updated!')
        setEditingElements((prev) => {
          const next = new Map(prev)
          next.delete(element.id)
          return next
        })
        mutate(cacheKey)
      } else {
        toast.error('Failed to update element')
      }
    } catch {
      toast.error('Failed to update element')
    } finally {
      setSavingElements((prev) => {
        const next = new Set(prev)
        next.delete(element.id)
        return next
      })
    }
  }

  const handleDeleteElement = async () => {
    if (!deleteDialog.element) return
    setDeleting(true)
    try {
      const ok = await dashboardsApi.deleteElement(dashboardId, deleteDialog.element.id)
      if (ok) {
        toast.success('Element deleted')
        mutate(cacheKey)
      } else {
        toast.error('Failed to delete element')
      }
    } catch {
      toast.error('Failed to delete element')
    } finally {
      setDeleting(false)
      setDeleteDialog({ open: false, element: null })
    }
  }

  const handleSaveAll = async () => {
    const promises = elements
      .filter((el) => editingElements.has(el.id))
      .map((el) => handleSaveElement(el))
    await Promise.all(promises)
  }

  const hasUnsavedChanges = editingElements.size > 0

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/resources/dashboards')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7" />
            {dashboard?.title || 'Dashboard'} — Configuration
          </h1>
        </div>
        {hasUnsavedChanges && (
          <Button onClick={handleSaveAll} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            Save All
          </Button>
        )}
      </div>

      {/* Info note */}
      <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 text-sm text-green-800">
        <strong>Note:</strong> Enter any internal Studently page URL (e.g., <code>/admin/attendance</code>) or
        an external URL. Each element is rendered as an embedded frame on the dashboard view.
      </div>

      {/* Elements Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading
              ? 'Loading...'
              : `${elements.length} dashboard element${elements.length !== 1 ? 's' : ''} found.`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-900 hover:bg-gray-900">
                    <TableHead className="w-12 text-white" />
                    <TableHead className="text-white font-semibold">URL</TableHead>
                    <TableHead className="text-white font-semibold text-center w-20">Sort Order</TableHead>
                    <TableHead className="text-white font-semibold text-center w-24">Width (%)</TableHead>
                    <TableHead className="text-white font-semibold text-center w-24">Height (px)</TableHead>
                    <TableHead className="text-white font-semibold w-56">Options</TableHead>
                    <TableHead className="text-white font-semibold text-center w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {elements.map((el) => {
                    const isSaving = savingElements.has(el.id)
                    const hasEdits = editingElements.has(el.id)
                    return (
                      <TableRow key={el.id}>
                        {/* Delete button */}
                        <TableCell className="text-center">
                          <button
                            className="text-red-500 hover:text-red-700"
                            title="Delete element"
                            onClick={() => setDeleteDialog({ open: true, element: el })}
                          >
                            <Minus className="h-5 w-5" />
                          </button>
                        </TableCell>

                        {/* URL */}
                        <TableCell>
                          <div className="space-y-1">
                            <a
                              href={el.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Link
                            </a>
                            <Input
                              value={getEditValue(el.id, 'url', el.url)}
                              onChange={(e) => setEditValue(el.id, 'url', e.target.value)}
                              placeholder="Page URL..."
                              className="text-sm"
                            />
                          </div>
                        </TableCell>

                        {/* Sort Order */}
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={getEditValue(el.id, 'sort_order', String(el.sort_order || ''))}
                            onChange={(e) => setEditValue(el.id, 'sort_order', e.target.value)}
                            className="text-center text-sm w-16 mx-auto"
                          />
                        </TableCell>

                        {/* Width */}
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={getEditValue(el.id, 'width_percent', String(el.width_percent))}
                            onChange={(e) => setEditValue(el.id, 'width_percent', e.target.value)}
                            className="text-center text-sm w-16 mx-auto"
                          />
                        </TableCell>

                        {/* Height */}
                        <TableCell>
                          <Input
                            type="number"
                            min={50}
                            max={5000}
                            value={getEditValue(el.id, 'height_px', String(el.height_px))}
                            onChange={(e) => setEditValue(el.id, 'height_px', e.target.value)}
                            className="text-center text-sm w-20 mx-auto"
                          />
                        </TableCell>

                        {/* Options: Refresh + CSS */}
                        <TableCell>
                          <div className="space-y-2">
                            <div>
                              <Input
                                type="number"
                                min={1}
                                placeholder=""
                                value={getEditValue(el.id, 'refresh_minutes', String(el.refresh_minutes || ''))}
                                onChange={(e) => setEditValue(el.id, 'refresh_minutes', e.target.value)}
                                className="text-sm w-20"
                              />
                              <span className="text-xs text-muted-foreground">Refresh after (minutes)</span>
                            </div>
                            <div>
                              <Textarea
                                placeholder=""
                                rows={3}
                                value={getEditValue(el.id, 'custom_css', el.custom_css || '')}
                                onChange={(e) => setEditValue(el.id, 'custom_css', e.target.value)}
                                className="text-xs font-mono"
                              />
                              <span className="text-xs text-muted-foreground">CSS</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Save per element */}
                        <TableCell className="text-center">
                          {hasEdits && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveElement(el)}
                              disabled={isSaving}
                              title="Save changes"
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* Add new element row */}
                  <TableRow className="bg-gray-50">
                    <TableCell className="text-center">
                      <button
                        className="text-green-600 hover:text-green-800"
                        title="Add element"
                        onClick={handleAddElement}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Plus className="h-5 w-5" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="/admin/attendance or https://..."
                        value={newElement.url}
                        onChange={(e) => setNewElement({ ...newElement, url: e.target.value })}
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={newElement.sort_order}
                        onChange={(e) => setNewElement({ ...newElement, sort_order: e.target.value })}
                        className="text-center text-sm w-16 mx-auto"
                        placeholder=""
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={newElement.width_percent}
                        onChange={(e) => setNewElement({ ...newElement, width_percent: e.target.value })}
                        className="text-center text-sm w-16 mx-auto"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={50}
                        max={5000}
                        value={newElement.height_px}
                        onChange={(e) => setNewElement({ ...newElement, height_px: e.target.value })}
                        className="text-center text-sm w-20 mx-auto"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div>
                          <Input
                            type="number"
                            min={1}
                            value={newElement.refresh_minutes}
                            onChange={(e) => setNewElement({ ...newElement, refresh_minutes: e.target.value })}
                            className="text-sm w-20"
                            placeholder=""
                          />
                          <span className="text-xs text-muted-foreground">Refresh after (minutes)</span>
                        </div>
                        <div>
                          <Textarea
                            rows={3}
                            value={newElement.custom_css}
                            onChange={(e) => setNewElement({ ...newElement, custom_css: e.target.value })}
                            className="text-xs font-mono"
                            placeholder=""
                          />
                          <span className="text-xs text-muted-foreground">CSS</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save All Button */}
      {hasUnsavedChanges && (
        <div className="flex justify-center">
          <Button onClick={handleSaveAll} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      )}

      {/* Delete Element Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Element</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this element from the dashboard?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, element: null })} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteElement} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
