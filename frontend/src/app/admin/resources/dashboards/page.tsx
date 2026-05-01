'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Minus, Settings, LayoutDashboard, Eye, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as dashboardsApi from '@/lib/api/dashboards'

export default function ResourceDashboardsPage() {
  useAuth()
  const t = useTranslations('school.resources.dashboards')
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const router = useRouter()

  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [dashboardToDelete, setDashboardToDelete] = useState<dashboardsApi.Dashboard | null>(null)
  const [deleting, setDeleting] = useState(false)

  const cacheKey = ['resource-dashboards', selectedCampus?.id]

  const { data: dashboards, isLoading } = useSWR(
    cacheKey,
    () => dashboardsApi.getDashboards(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const result = await dashboardsApi.createDashboard({
        title: newTitle.trim(),
        campus_id: selectedCampus?.id,
      })
      if (result) {
        toast.success(t('msg_create_success'))
        setNewTitle('')
        mutate(cacheKey)
      } else {
        toast.error(t('msg_create_error'))
      }
    } catch {
      toast.error(t('msg_create_error'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (d: dashboardsApi.Dashboard) => {
    setDashboardToDelete(d)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!dashboardToDelete) return
    setDeleting(true)
    try {
      const ok = await dashboardsApi.deleteDashboard(dashboardToDelete.id)
      if (ok) {
        toast.success(t('msg_delete_success'))
        mutate(cacheKey)
      } else {
        toast.error(t('msg_delete_error'))
      }
    } catch {
      toast.error(t('msg_delete_error'))
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setDashboardToDelete(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white flex items-center gap-2">
          <LayoutDashboard className="h-7 w-7" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? t('loading') : (dashboards || []).length === 1 ? t('dashboards_found_singular') : t('dashboards_found', { count: (dashboards || []).length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-900 hover:bg-gray-900">
                    <TableHead className="w-12 text-white" />
                    <TableHead className="text-white font-semibold">{t('th_title')}</TableHead>
                    <TableHead className="text-white font-semibold text-center w-40">{t('th_configuration')}</TableHead>
                    <TableHead className="text-white font-semibold text-center w-24">{t('th_view')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboards || []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-center">
                        <button
                          className="text-red-500 hover:text-red-700 text-lg font-bold"
                          title="Delete dashboard"
                          onClick={() => confirmDelete(d)}
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          className="text-blue-600 hover:underline text-left"
                          onClick={() => router.push(`/admin/resources/dashboards/${d.id}`)}
                        >
                          {d.title}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          onClick={() => router.push(`/admin/resources/dashboards/${d.id}/configure`)}
                        >
                          <Settings className="h-4 w-4" />
                          {t('btn_configuration')}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          onClick={() => router.push(`/admin/resources/dashboards/${d.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* New row for adding */}
                  <TableRow>
                    <TableCell className="text-center">
                      <button
                        className="text-green-600 hover:text-green-800 text-lg font-bold"
                        title="Add dashboard"
                        onClick={handleCreate}
                        disabled={saving || !newTitle.trim()}
                      >
                        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                      </button>
                    </TableCell>
                    <TableCell colSpan={3}>
                      <Input
                        placeholder={t('input_placeholder')}
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreate()
                        }}
                        className="max-w-sm"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_confirm_title')}</DialogTitle>
            <DialogDescription>
              {t('delete_confirm_desc', { name: dashboardToDelete?.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              {t('btn_cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                t('btn_confirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
