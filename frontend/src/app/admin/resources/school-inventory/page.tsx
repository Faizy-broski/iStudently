'use client'

import { useState, useEffect, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Minus, Save, Loader2, Package, X, Filter } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  type CategoryType,
  type InventoryCategory,
  getInventoryCategories,
  bulkSaveInventoryCategories,
} from '@/lib/api/school-inventory'

// ---- Constants ----

const CATEGORY_TYPES: { type: CategoryType; label: string }[] = [
  { type: 'CATEGORY', label: 'Category' },
  { type: 'STATUS', label: 'Status' },
  { type: 'LOCATION', label: 'Location' },
  { type: 'PERSON', label: 'Person' },
]

// ---- Editable types ----

interface EditableCategory extends Partial<InventoryCategory> {
  category_type: CategoryType
  title: string
  isNew?: boolean
}


// ---- Component ----

export default function SchoolInventoryPage() {
  useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const router = useRouter()

  // ---- Category state per type ----
  const [editableCategories, setEditableCategories] = useState<
    Record<CategoryType, EditableCategory[]>
  >({ CATEGORY: [], STATUS: [], LOCATION: [], PERSON: [] })
  const [newCategoryTitles, setNewCategoryTitles] = useState<Record<CategoryType, string>>({
    CATEGORY: '',
    STATUS: '',
    LOCATION: '',
    PERSON: '',
  })
  const [categoriesInitialized, setCategoriesInitialized] = useState(false)

  // ---- Saving ----
  const [saving, setSaving] = useState(false)

  // ---- Delete dialog ----
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    type: 'category' | 'item'
    categoryType?: CategoryType
    index: number
  } | null>(null)

  // ---- SWR keys include campus so data re-fetches on campus change ----
  const catCacheKey = ['inventory-categories', selectedCampus?.id]

  const { data: serverCategories, isLoading: loadingCats } = useSWR(
    catCacheKey,
    () => getInventoryCategories(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  // ---- Reset on campus change ----
  useEffect(() => {
    setCategoriesInitialized(false)
  }, [selectedCampus?.id])

  // ---- Initialize categories from server ----
  useEffect(() => {
    if (!serverCategories || categoriesInitialized) return
    const grouped: Record<CategoryType, EditableCategory[]> = {
      CATEGORY: [],
      STATUS: [],
      LOCATION: [],
      PERSON: [],
    }
    for (const cat of serverCategories) {
      grouped[cat.category_type].push({ ...cat })
    }
    setEditableCategories(grouped)
    setCategoriesInitialized(true)
  }, [serverCategories, categoriesInitialized])


  // ---- Category handlers ----

  const addCategory = (type: CategoryType) => {
    const title = newCategoryTitles[type].trim()
    if (!title) return
    setEditableCategories((prev) => ({
      ...prev,
      [type]: [...prev[type], { category_type: type, title, isNew: true }],
    }))
    setNewCategoryTitles((prev) => ({ ...prev, [type]: '' }))
  }

  const requestDeleteCategory = (type: CategoryType, index: number) => {
    setDeleteDialog({ open: true, type: 'category', categoryType: type, index })
  }

  const confirmDeleteCategory = () => {
    if (!deleteDialog || deleteDialog.type !== 'category' || !deleteDialog.categoryType) return
    const { categoryType, index } = deleteDialog
    setEditableCategories((prev) => ({
      ...prev,
      [categoryType]: prev[categoryType].filter((_, i) => i !== index),
    }))
    setDeleteDialog(null)
  }


  // ---- Save ----

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const campusId = selectedCampus?.id

      // Save categories per type
      for (const { type } of CATEGORY_TYPES) {
        const cats = editableCategories[type]
        const existingIds = (serverCategories || [])
          .filter((c) => c.category_type === type)
          .map((c) => c.id)
        await bulkSaveInventoryCategories(
          cats.map((c) => ({
            id: c.id,
            category_type: type,
            title: c.title,
            color: c.color,
          })),
          existingIds,
          campusId
        )
      }

      await mutate(catCacheKey)
      setCategoriesInitialized(false)
      toast.success('Inventory saved successfully')
    } catch {
      toast.error('Failed to save inventory')
    } finally {
      setSaving(false)
    }
  }, [editableCategories, serverCategories, selectedCampus?.id, catCacheKey])

  // ---- Computed ----

  const isLoading = loadingCats

  // ---- Render ----

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">School Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Categories
              {selectedCampus && (
                <span className="ml-2 text-primary font-medium">— {selectedCampus.name}</span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      {/* Category panels */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_TYPES.map(({ type }) => (
            <Skeleton key={type} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_TYPES.map(({ type, label }) => {
            const cats = editableCategories[type]
            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-primary uppercase tracking-wide">
                    {label}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {cats.length} {cats.length === 1 ? 'entry' : 'entries'} found.
                  </p>
                </CardHeader>
                <CardContent className="space-y-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs px-1">Name</TableHead>
                        <TableHead className="text-xs px-1 text-right">Total</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cats.map((cat, idx) => {
                        const count = serverCategories?.find((c) => c.id === cat.id)?.item_count || 0
                        return (
                          <TableRow key={idx}>
                            <TableCell className="px-1 py-1">
                              <button
                                onClick={() => {
                                  if (!cat.id) return
                                  // navigate to dedicated inventory page for this category/type
                                  router.push(
                                    `/admin/resources/school-inventory/inventory?type=${type}&categoryId=${cat.id}&categoryTitle=${encodeURIComponent(
                                      cat.title
                                    )}`
                                  )
                                }}
                                className="text-primary text-sm hover:underline text-left w-full"
                              >
                                {cat.title}
                              </button>
                            </TableCell>
                            <TableCell className="px-1 py-1 text-right text-sm">{count}</TableCell>
                            <TableCell className="px-1 py-1">
                              <button
                                onClick={() => requestDeleteCategory(type, idx)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  {/* Add new category row */}
                  <div className="flex items-center gap-1 pt-1">
                    <button
                      onClick={() => addCategory(type)}
                      className="text-primary hover:text-primary/80"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <Input
                      value={newCategoryTitles[type]}
                      onChange={(e) =>
                        setNewCategoryTitles((prev) => ({ ...prev, [type]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && addCategory(type)}
                      placeholder={`Add ${label.toLowerCase()}...`}
                      className="h-7 text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}


      {/* Save button (bottom) */}
      <div className="flex justify-center">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      {/* Delete confirmation dialog (categories only) */}
      <Dialog open={!!deleteDialog?.open} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Remove this category? Items assigned to it will lose this assignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteCategory}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
