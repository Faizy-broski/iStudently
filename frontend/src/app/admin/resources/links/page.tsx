'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Minus, Search, Link2, Loader2, Save, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  getResourceLinks,
  bulkSaveResourceLinks,
} from '@/lib/api/resource-links'

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'admin', label: 'Administrator' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'parent', label: 'Parent' },
]

interface EditableLink {
  id?: string
  title: string
  url: string
  visible_to: string[]
  isNew?: boolean
}

export default function ResourceLinksPage() {
  useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [editableLinks, setEditableLinks] = useState<EditableLink[]>([])
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<number | null>(null)
  const [visibleDropdown, setVisibleDropdown] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (visibleDropdown === null) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setVisibleDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [visibleDropdown])

  const cacheKey = ['resource-links', selectedCampus?.id]

  const { data: serverLinks, isLoading } = useSWR(
    cacheKey,
    () => getResourceLinks(selectedCampus?.id),
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (!initialized) {
          setEditableLinks(
            data.map((l) => ({
              id: l.id,
              title: l.title,
              url: l.url,
              visible_to: l.visible_to || [],
            }))
          )
          setInitialized(true)
        }
      },
    }
  )

  // Reset initialized flag when campus changes
  const [lastCampusId, setLastCampusId] = useState<string | undefined>()
  if (selectedCampus?.id !== lastCampusId) {
    setLastCampusId(selectedCampus?.id)
    setInitialized(false)
  }

  // Filter by search
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return editableLinks
    const q = searchQuery.toLowerCase()
    return editableLinks.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q)
    )
  }, [editableLinks, searchQuery])

  const handleAddNew = () => {
    setEditableLinks((prev) => [
      ...prev,
      { title: '', url: '', visible_to: ['admin'], isNew: true },
    ])
  }

  const confirmDelete = (index: number) => {
    setLinkToDelete(index)
    setDeleteDialogOpen(true)
  }

  const handleDelete = () => {
    if (linkToDelete === null) return
    // Find the actual index in editableLinks (not filtered)
    const linkToRemove = filteredLinks[linkToDelete]
    setEditableLinks((prev) => prev.filter((l) => l !== linkToRemove))
    setDeleteDialogOpen(false)
    setLinkToDelete(null)
  }

  const updateLink = (index: number, field: keyof EditableLink, value: string | string[]) => {
    const actualLink = filteredLinks[index]
    setEditableLinks((prev) =>
      prev.map((l) => (l === actualLink ? { ...l, [field]: value } : l))
    )
  }

  const toggleRole = (index: number, role: string) => {
    const actualLink = filteredLinks[index]
    setEditableLinks((prev) =>
      prev.map((l) => {
        if (l !== actualLink) return l
        const current = l.visible_to || []
        const updated = current.includes(role)
          ? current.filter((r) => r !== role)
          : [...current, role]
        return { ...l, visible_to: updated }
      })
    )
  }

  const removeRole = (index: number, role: string) => {
    const actualLink = filteredLinks[index]
    setEditableLinks((prev) =>
      prev.map((l) => {
        if (l !== actualLink) return l
        return { ...l, visible_to: (l.visible_to || []).filter((r) => r !== role) }
      })
    )
  }

  const handleSave = async () => {
    // Validate
    for (const link of editableLinks) {
      if (!link.title.trim()) {
        toast.error('All resources must have a title')
        return
      }
      if (!link.url.trim()) {
        toast.error('All resources must have a URL/link')
        return
      }
    }

    setSaving(true)
    try {
      const existingIds = (serverLinks || []).map((l) => l.id)
      await bulkSaveResourceLinks(
        editableLinks.map((l, i) => ({
          id: l.id,
          title: l.title.trim(),
          url: l.url.trim(),
          visible_to: l.visible_to,
          sort_order: i + 1,
        })),
        existingIds
      )

      // Refresh from server
      setInitialized(false)
      mutate(cacheKey)
      toast.success('Resources saved successfully!')
    } catch {
      toast.error('Failed to save resources')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white flex items-center gap-2">
            <Link2 className="h-7 w-7" />
            Resources
          </h1>
          <p className="text-muted-foreground mt-1">
            Add external links visible to specific user roles.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#008B8B] hover:bg-[#007070] text-white"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-sm text-muted-foreground">
            {isLoading
              ? 'Loading...'
              : `${editableLinks.length} resource${editableLinks.length !== 1 ? 's' : ''} found.`}
          </CardTitle>
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-visible">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="border rounded-md overflow-visible">
              <div className="relative w-full overflow-visible">
              <table className="w-full caption-bottom text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-900 hover:bg-gray-900">
                    <TableHead className="w-12 text-white" />
                    <TableHead className="text-white font-semibold">Title</TableHead>
                    <TableHead className="text-white font-semibold">Link</TableHead>
                    <TableHead className="text-white font-semibold w-64">Visible To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLinks.map((link, idx) => (
                    <TableRow key={link.id || `new-${idx}`}>
                      {/* Delete button */}
                      <TableCell className="text-center">
                        <button
                          className="text-red-500 hover:text-red-700 text-lg font-bold"
                          title="Delete resource"
                          onClick={() => confirmDelete(idx)}
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      </TableCell>

                      {/* Title */}
                      <TableCell>
                        <Input
                          value={link.title}
                          onChange={(e) => updateLink(idx, 'title', e.target.value)}
                          placeholder="Resource title..."
                          className="max-w-xs"
                        />
                      </TableCell>

                      {/* Link / URL */}
                      <TableCell>
                        <Input
                          value={link.url}
                          onChange={(e) => updateLink(idx, 'url', e.target.value)}
                          placeholder="https://..."
                          className="max-w-md"
                        />
                      </TableCell>

                      {/* Visible To - multi-select with badges */}
                      <TableCell>
                        <div className="relative" ref={visibleDropdown === idx ? dropdownRef : undefined}>
                          {/* Selected roles as badges */}
                          <div
                            className="flex flex-wrap gap-1 min-h-9 p-1.5 border rounded-md cursor-pointer bg-background"
                            onClick={() =>
                              setVisibleDropdown(visibleDropdown === idx ? null : idx)
                            }
                          >
                            {(link.visible_to || []).length === 0 ? (
                              <span className="text-muted-foreground text-sm px-1">
                                Select some Options
                              </span>
                            ) : (
                              (link.visible_to || []).map((role) => {
                                const label =
                                  ROLE_OPTIONS.find((r) => r.value === role)?.label || role
                                return (
                                  <Badge
                                    key={role}
                                    variant="secondary"
                                    className="flex items-center gap-1 text-xs"
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        removeRole(idx, role)
                                      }}
                                      className="hover:text-red-500"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                    {label}
                                  </Badge>
                                )
                              })
                            )}
                          </div>

                          {/* Dropdown */}
                          {visibleDropdown === idx && (
                            <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg overflow-visible">
                              {ROLE_OPTIONS.map((opt) => {
                                const isSelected = (link.visible_to || []).includes(opt.value)
                                return (
                                  <button
                                    key={opt.value}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-500 hover:text-white transition-colors ${
                                      isSelected ? 'bg-blue-500 text-white' : ''
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleRole(idx, opt.value)
                                    }}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Add new row */}
                  <TableRow>
                    <TableCell className="text-center">
                      <button
                        className="text-green-600 hover:text-green-800 text-lg font-bold"
                        title="Add resource"
                        onClick={handleAddNew}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </TableCell>
                    <TableCell
                      colSpan={3}
                      className="text-muted-foreground text-sm italic"
                    >
                      Click + to add a new resource link
                    </TableCell>
                  </TableRow>
                </TableBody>
              </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resource</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;
              {linkToDelete !== null ? filteredLinks[linkToDelete]?.title || 'Untitled' : ''}
              &quot;? Click Save to confirm changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
