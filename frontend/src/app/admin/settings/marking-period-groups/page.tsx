"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { Plus, Edit, Trash2, Loader2, CalendarRange, Info, AlertTriangle } from "lucide-react"
import {
  getMarkingPeriodGroups,
  createMarkingPeriodGroup,
  updateMarkingPeriodGroup,
  deleteMarkingPeriodGroup,
  type MarkingPeriodGroup,
} from "@/lib/api/marking-period-groups"
import { useCampus } from "@/context/CampusContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import { useTranslations } from "next-intl"

export default function MarkingPeriodGroupsPage() {
  const t = useTranslations('school.marking_period_groups_page')
  const { selectedCampus } = useCampus()
  const { isPluginActive, loading: settingsLoading } = useSchoolSettings()

  const [groups, setGroups] = useState<MarkingPeriodGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<MarkingPeriodGroup | null>(null)
  const [name, setName] = useState("")
  const [applyToWholeSchool, setApplyToWholeSchool] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const pluginActive = isPluginActive('marking_period_groups')

  useEffect(() => {
    loadGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampus?.id])

  const loadGroups = async () => {
    try {
      setLoading(true)
      const data = await getMarkingPeriodGroups(selectedCampus?.id)
      setGroups(data)
    } catch (error: any) {
      toast.error(error.message || t('fetch_error'))
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName("")
    setApplyToWholeSchool(false)
    setEditingGroup(null)
  }

  const handleEdit = (group: MarkingPeriodGroup) => {
    setEditingGroup(group)
    setName(group.name)
    setApplyToWholeSchool(!group.campus_id)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('name_required'))
      return
    }
    setSaving(true)
    try {
      if (editingGroup) {
        await updateMarkingPeriodGroup(editingGroup.id, { name })
        toast.success(t('update_success'))
      } else {
        await createMarkingPeriodGroup({
          name,
          campus_id: applyToWholeSchool ? null : selectedCampus?.id,
        })
        toast.success(t('create_success'))
      }
      setIsDialogOpen(false)
      resetForm()
      loadGroups()
    } catch (error: any) {
      toast.error(error.message || t('update_error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: MarkingPeriodGroup) => {
    if (group.is_default) return
    if (!confirm(t('delete_confirm', { name: group.name }))) return

    setDeletingId(group.id)
    try {
      await deleteMarkingPeriodGroup(group.id)
      toast.success(t('delete_success'))
      loadGroups()
    } catch (error: any) {
      toast.error(error.message || t('delete_error'))
    } finally {
      setDeletingId(null)
    }
  }

  if (!settingsLoading && !pluginActive) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-muted-foreground/30 p-6 text-muted-foreground">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm">
            {t('inactive_notice')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          {t('title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('subtitle')}
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
          {t.rich('info_banner', {
            grade_levels: (chunks) => <strong>{chunks}</strong>,
            default: (chunks) => <strong>{chunks}</strong>,
          })}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('card_title')}</CardTitle>
            <CardDescription>{t('card_desc')}</CardDescription>
          </div>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button style={{ background: "var(--gradient-blue)" }} className="text-white hover:opacity-90 transition-opacity">
                <Plus className="h-4 w-4 mr-2" />
                {t('btn_add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingGroup ? t('dialog_edit_title') : t('dialog_add_title')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{t('label_name')}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('placeholder_name')}
                    required
                  />
                </div>
                {!editingGroup && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToWholeSchool}
                      onChange={(e) => setApplyToWholeSchool(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{t('checkbox_whole_school')}</span>
                  </label>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('btn_cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    style={{ background: "var(--gradient-blue)" }}
                    className="text-white hover:opacity-90 transition-opacity"
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {editingGroup ? t('btn_update') : t('btn_create')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-[#57A3CC]/10 to-[#022172]/10">
                  <TableHead>{t('th_name')}</TableHead>
                  <TableHead>{t('th_scope')}</TableHead>
                  <TableHead className="text-right">{t('th_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      {t('no_groups')}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium flex items-center gap-2">
                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                        {group.name}
                        {group.is_default && (
                          <Badge variant="default" className="bg-green-600">{t('badge_default')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{group.campus_id ? t('scope_campus') : t('scope_whole_school')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(group)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!group.is_default && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingId === group.id}
                              onClick={() => handleDelete(group)}
                            >
                              {deletingId === group.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
