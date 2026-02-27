'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Plus, Minus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  type CategoryType,
  type InventoryCategory,
  type InventoryItem,
  getInventoryCategories,
  getInventoryItems,
  bulkSaveInventoryItems,
  deleteInventoryItem,
} from '@/lib/api/school-inventory'

// --- editable version of item for UI ---
interface EditableItem {
  id?: string
  title: string
  quantity: number
  comments?: string
  category_ids: string[]
  file?: File | null
  isNew?: boolean
}

function buildEditableItems(items: InventoryItem[]): EditableItem[] {
  return items.map((i) => ({
    ...i,
    category_ids: (i.categories || []).map((c) => c.id),
    file: null,
  }))
}

export default function InventoryPage() {
  useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const router = useRouter()
  const searchParams = useSearchParams()

  const typeParam = searchParams.get('type') as CategoryType | null
  const categoryId = searchParams.get('categoryId')
  const categoryTitle = searchParams.get('categoryTitle') || ''

  const [allCategories, setAllCategories] = useState<
    Record<CategoryType, InventoryCategory[]>
  >({ CATEGORY: [], STATUS: [], LOCATION: [], PERSON: [] })

  const [editableItems, setEditableItems] = useState<EditableItem[]>([])
  const [newItemTitle, setNewItemTitle] = useState('')
  const [saving, setSaving] = useState(false)

  // fetch categories once
  useEffect(() => {
    if (!selectedCampus) return
    getInventoryCategories(selectedCampus.id).then((cats) => {
      const grouped: Record<CategoryType, InventoryCategory[]> = {
        CATEGORY: [],
        STATUS: [],
        LOCATION: [],
        PERSON: [],
      }
      for (const c of cats) {
        grouped[c.category_type].push(c)
      }
      setAllCategories(grouped)
    })
  }, [selectedCampus])

  // fetch items filtered by categoryId
  useEffect(() => {
    if (!selectedCampus) return
    getInventoryItems(selectedCampus.id, categoryId || undefined).then((items) => {
      setEditableItems(buildEditableItems(items))
    })
  }, [selectedCampus, categoryId])

  const addItem = () => {
    const title = newItemTitle.trim()
    if (!title) return
    const initialIds: string[] = []
    if (categoryId) {
      initialIds.push(categoryId)
    }
    setEditableItems((prev) => [
      ...prev,
      { title, quantity: 0, comments: '', category_ids: initialIds, file: null, isNew: true },
    ])
    setNewItemTitle('')
  }

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setEditableItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  const requestDeleteItem = async (index: number) => {
    const item = editableItems[index]
    if (item?.id) {
      try {
        await deleteInventoryItem(item.id)
        toast.success('Item removed')
      } catch {
        toast.error('Failed to delete item')
      }
    }
    setEditableItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCategoryChange = (
    itemIndex: number,
    categoryId: string,
    catType: CategoryType
  ) => {
    setEditableItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item
        // remove any existing id of same type
        const existing = allCategories[catType].map((c) => c.id)
        const otherIds = item.category_ids.filter((id) => !existing.includes(id))
        return { ...item, category_ids: [...otherIds, categoryId] }
      })
    )
  }

  const handleFileChange = (index: number, file: File | null) => {
    setEditableItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, file } : item))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const campusId = selectedCampus?.id
      const existingIds = editableItems
        .filter((i) => i.id)
        .map((i) => i.id!) // keep defined
      await bulkSaveInventoryItems(
        editableItems.map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          comments: item.comments,
          category_ids: item.category_ids,
        })),
        existingIds,
        campusId
      )
      toast.success('Items saved')
      router.refresh()
    } catch {
      toast.error('Failed to save items')
    } finally {
      setSaving(false)
    }
  }

  const categoriesForType = (type: CategoryType) => allCategories[type] || []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/resources/school-inventory')}>
            Back
          </Button>
          <h1 className="text-2xl font-bold">
            {typeParam && categoryTitle
              ? `${typeParam.charAt(0) + typeParam.slice(1).toLowerCase()}: ${categoryTitle}`
              : 'Inventory'}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> Save
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Qty</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Person</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {editableItems.map((item, idx) => {
            const findId = (type: CategoryType) =>
              item.category_ids.find((id) =>
                categoriesForType(type).some((c) => c.id === id)
              ) || ''
            return (
              <TableRow key={idx}>
                <TableCell>
                  <Input
                    value={item.title}
                    onChange={(e) => updateItem(idx, { title: e.target.value })}
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: parseInt(e.target.value) || 0 })
                    }
                    className="h-8 text-sm w-20"
                  />
                </TableCell>
                <TableCell>
                  <input
                    type="file"
                    onChange={(e) =>
                      handleFileChange(idx, e.target.files ? e.target.files[0] : null)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={item.comments || ''}
                    onChange={(e) => updateItem(idx, { comments: e.target.value })}
                    className="h-8 text-sm"
                  />
                </TableCell>
                <TableCell>
                  <select
                    value={findId('CATEGORY')}
                    onChange={(e) => handleCategoryChange(idx, e.target.value, 'CATEGORY')}
                    disabled={typeParam === 'CATEGORY'}
                    className="h-8 text-sm w-full"
                  >
                    <option value="">-</option>
                    {categoriesForType('CATEGORY').map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    value={findId('STATUS')}
                    onChange={(e) => handleCategoryChange(idx, e.target.value, 'STATUS')}
                    disabled={typeParam === 'STATUS'}
                    className="h-8 text-sm w-full"
                  >
                    <option value="">-</option>
                    {categoriesForType('STATUS').map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    value={findId('LOCATION')}
                    onChange={(e) => handleCategoryChange(idx, e.target.value, 'LOCATION')}
                    disabled={typeParam === 'LOCATION'}
                    className="h-8 text-sm w-full"
                  >
                    <option value="">-</option>
                    {categoriesForType('LOCATION').map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    value={findId('PERSON')}
                    onChange={(e) => handleCategoryChange(idx, e.target.value, 'PERSON')}
                    disabled={typeParam === 'PERSON'}
                    className="h-8 text-sm w-full"
                  >
                    <option value="">-</option>
                    {categoriesForType('PERSON').map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => requestDeleteItem(idx)}
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
      <div className="flex items-center gap-2 mt-3">
        <button onClick={addItem} className="text-primary hover:text-primary/80">
          <Plus className="h-4 w-4" />
        </button>
        <Input
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add new item..."
          className="h-8 text-sm max-w-xs"
        />
      </div>
    </div>
  )
}
