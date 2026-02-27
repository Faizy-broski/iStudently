'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
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
import { Camera, Plus, Trash2, Loader2, ChevronLeft, Package } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  type InventorySnapshot,
  type SnapshotDetail,
  type CategoryType,
  getInventorySnapshots,
  getInventorySnapshotDetail,
  createInventorySnapshot,
  deleteInventorySnapshot,
} from '@/lib/api/school-inventory'

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  CATEGORY: 'Category',
  STATUS: 'Status',
  LOCATION: 'Location',
  PERSON: 'Person',
}

export default function InventorySnapshotsPage() {
  useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    snapshot: InventorySnapshot | null
  }>({ open: false, snapshot: null })
  const [deleting, setDeleting] = useState(false)

  // ---- SWR key includes campus so list re-fetches on switch ----
  const listCacheKey = ['inventory-snapshots', selectedCampus?.id]

  const { data: snapshots, isLoading } = useSWR(
    listCacheKey,
    () => getInventorySnapshots(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  const { data: snapshotDetail, isLoading: loadingDetail } = useSWR(
    selectedSnapshotId ? ['inventory-snapshot', selectedSnapshotId] : null,
    () => getInventorySnapshotDetail(selectedSnapshotId!),
    { revalidateOnFocus: false }
  )

  // ---- Create snapshot ----
  const handleCreate = async () => {
    const title = newTitle.trim()
    if (!title) {
      toast.error('Please enter a snapshot name')
      return
    }
    setCreating(true)
    try {
      const created = await createInventorySnapshot(title, selectedCampus?.id)
      if (!created) throw new Error('Failed')
      setNewTitle('')
      await mutate(listCacheKey)
      toast.success(`Snapshot "${created.title}" created`)
    } catch {
      toast.error('Failed to create snapshot')
    } finally {
      setCreating(false)
    }
  }

  // ---- Delete snapshot ----
  const handleDelete = async () => {
    if (!deleteDialog.snapshot) return
    setDeleting(true)
    try {
      await deleteInventorySnapshot(deleteDialog.snapshot.id)
      if (selectedSnapshotId === deleteDialog.snapshot.id) setSelectedSnapshotId(null)
      await mutate(listCacheKey)
      toast.success('Snapshot deleted')
      setDeleteDialog({ open: false, snapshot: null })
    } catch {
      toast.error('Failed to delete snapshot')
    } finally {
      setDeleting(false)
    }
  }

  // ---- Detail view ----
  if (selectedSnapshotId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedSnapshotId(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Camera className="h-6 w-6 text-primary" />
              {loadingDetail ? 'Loading...' : snapshotDetail?.title}
            </h1>
            {snapshotDetail && (
              <p className="text-sm text-muted-foreground">
                Snapshot taken on{' '}
                {new Date(snapshotDetail.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {selectedCampus && (
                  <span className="ml-2 text-primary font-medium">— {selectedCampus.name}</span>
                )}
              </p>
            )}
          </div>
        </div>

        {loadingDetail ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : snapshotDetail ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                {snapshotDetail.items.length} Items (read-only)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Assignments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshotDetail.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.comments || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.categories.map((cat) => (
                            <Badge key={cat.id} variant="outline" className="text-xs">
                              <span className="text-muted-foreground mr-1">
                                {CATEGORY_TYPE_LABELS[cat.category_type]}:
                              </span>
                              {cat.title}
                            </Badge>
                          ))}
                          {item.categories.length === 0 && (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {snapshotDetail.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No items in this snapshot.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground">Snapshot not found.</p>
        )}
      </div>
    )
  }

  // ---- List view ----
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Camera className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Inventory Snapshots</h1>
          <p className="text-sm text-muted-foreground">
            Point-in-time snapshots of your inventory.
            {selectedCampus && (
              <span className="ml-1 text-primary font-medium">— {selectedCampus.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* Create new snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-md">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Snapshot name (e.g. Start of Term 2026)..."
              className="flex-1"
            />
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create
            </Button>
          </div>
          {selectedCampus && (
            <p className="text-xs text-muted-foreground mt-2">
              Snapshot will capture inventory for <strong>{selectedCampus.name}</strong>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Snapshot list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isLoading
              ? 'Loading...'
              : `${snapshots?.length ?? 0} Snapshot${(snapshots?.length ?? 0) !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !snapshots || snapshots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No snapshots yet.</p>
              <p className="text-sm mt-1">
                Create a snapshot to preserve the current inventory state.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell>
                      <button
                        onClick={() => setSelectedSnapshotId(snapshot.id)}
                        className="text-primary hover:underline font-medium"
                      >
                        {snapshot.title}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(snapshot.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog({ open: true, snapshot })}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, snapshot: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Snapshot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.snapshot?.title}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, snapshot: null })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
