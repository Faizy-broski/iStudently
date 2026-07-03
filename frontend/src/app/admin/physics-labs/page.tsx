'use client'

import { useEffect, useState, useMemo } from 'react'
import { FlaskConical, Plus, Trash2, Pencil, Search, X, Users, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getGradeLevels, getSubjects, type GradeLevel, type Subject } from '@/lib/api/academics'
import {
  getPhysicsLabs,
  assignLab,
  updateLab,
  unassignLab,
  getLabSubmissions,
  type PhysicsLab,
  type PhysicsLabSubmission,
} from '@/lib/api/physics-labs'
import {
  PHYSICS_CATALOG,
  SIM_CATEGORIES,
  CATEGORY_LABELS_AR,
  getSimLocalized,
  type SimulationMeta,
  type SimCategory,
} from '@/lib/physics-labs-catalog'

const CATEGORY_COLORS: Record<SimCategory, string> = {
  'Pendulums':       'bg-blue-100 text-blue-800',
  'Springs':         'bg-green-100 text-green-800',
  'Collisions':      'bg-red-100 text-red-800',
  'Roller Coasters': 'bg-orange-100 text-orange-800',
  'Orbital':         'bg-purple-100 text-purple-800',
  'Waves':           'bg-cyan-100 text-cyan-800',
  'Other':           'bg-gray-100 text-gray-700',
}

export default function PhysicsLabsAdminPage() {
  const t = useTranslations('physicsLabs')
  const locale = useLocale()
  const simText = (sim: SimulationMeta) => getSimLocalized(sim, locale)
  const catLabel = (cat: SimCategory) => locale === 'ar' ? CATEGORY_LABELS_AR[cat] : cat
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [assignedLabs, setAssignedLabs] = useState<PhysicsLab[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  // Catalog filters
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<SimCategory | 'All'>('All')

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<SimulationMeta | null>(null)
  const [assignGrades, setAssignGrades] = useState<string[]>([])
  const [assignSubject, setAssignSubject] = useState<string>('none')
  const [assignNote, setAssignNote] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Edit dialog
  const [editLab, setEditLab] = useState<PhysicsLab | null>(null)
  const [editGrade, setEditGrade] = useState<string>('none')
  const [editSubject, setEditSubject] = useState<string>('none')
  const [editNote, setEditNote] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<PhysicsLab | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Preview
  const [previewSim, setPreviewSim] = useState<SimulationMeta | null>(null)

  // Submissions viewer
  const [submissionsLab, setSubmissionsLab] = useState<PhysicsLab | null>(null)
  const [submissions, setSubmissions] = useState<PhysicsLabSubmission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  const schoolId = profile?.school_id || profile?.campus_id

  useEffect(() => {
    if (!schoolId) return
    const load = async () => {
      setLoading(true)
      const gradeSchoolId = campusId || schoolId
      const [labsRes, gradesRes, subjectsRes] = await Promise.all([
        getPhysicsLabs({ school_id: gradeSchoolId }),
        getGradeLevels(gradeSchoolId),
        getSubjects(undefined, gradeSchoolId),
      ])
      if (labsRes.success && labsRes.data)         setAssignedLabs(labsRes.data)
      if (gradesRes.success && gradesRes.data)     setGrades(gradesRes.data)
      if (subjectsRes.success && subjectsRes.data) setSubjects(subjectsRes.data)
      setLoading(false)
    }
    load()
  }, [schoolId, campusId])

  const filteredCatalog = useMemo(() => {
    return PHYSICS_CATALOG.filter(sim => {
      const ar = locale === 'ar' ? getSimLocalized(sim, locale) : null
      const q = search.toLowerCase()
      const matchesSearch =
        search.length === 0 ||
        sim.title.toLowerCase().includes(q) ||
        sim.description.toLowerCase().includes(q) ||
        sim.topics.some(topic => topic.toLowerCase().includes(q)) ||
        (ar && (
          ar.title.includes(search) ||
          ar.description.includes(search) ||
          ar.topics.some(topic => topic.includes(search))
        ))
      const matchesCategory = activeCategory === 'All' || sim.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [search, activeCategory, locale])

  const assignedKeys = useMemo(() => new Set(assignedLabs.map(l => l.sim_key)), [assignedLabs])

  function getCatalogEntry(simKey: string): SimulationMeta | undefined {
    return PHYSICS_CATALOG.find(s => s.key === simKey)
  }

  // ── Assign ──────────────────────────────────────────────────────────────────

  function openAssign(sim: SimulationMeta) {
    setAssignTarget(sim)
    const existing = assignedLabs.filter(l => l.sim_key === sim.key)
    setAssignGrades(existing.filter(l => l.grade_id).map(l => l.grade_id!))
    setAssignSubject(existing[0]?.subject_id || 'none')
    setAssignNote(existing[0]?.custom_note || '')
  }

  function toggleAssignGrade(gradeId: string, checked: boolean) {
    setAssignGrades(prev => checked ? [...prev, gradeId] : prev.filter(id => id !== gradeId))
  }

  async function handleAssign() {
    if (!assignTarget || !schoolId) return
    setAssigning(true)
    const effectiveSchoolId = campusId || schoolId
    const gradesToAssign = assignGrades.length > 0 ? assignGrades : [null]
    const subjectId = assignSubject !== 'none' ? assignSubject : null
    const note = assignNote.trim() || null

    // Remove grades that were previously assigned but are now unchecked
    const prevAssigned = assignedLabs.filter(l => l.sim_key === assignTarget.key && l.grade_id)
    const toRemove = prevAssigned.filter(l => !assignGrades.includes(l.grade_id!))
    await Promise.allSettled(toRemove.map(l => unassignLab(l.id, effectiveSchoolId)))

    // Create new records for grades not yet assigned
    const prevGradeIds = new Set(prevAssigned.map(l => l.grade_id))
    const toAdd = gradesToAssign.filter(gId => gId === null || !prevGradeIds.has(gId))
    const results = await Promise.allSettled(
      toAdd.map(gradeId => assignLab({
        sim_key:     assignTarget.key,
        school_id:   effectiveSchoolId,
        grade_id:    gradeId,
        subject_id:  subjectId,
        custom_note: note,
      }))
    )
    setAssigning(false)

    const newLabs = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.success)
      .map(r => r.value.data!)

    setAssignedLabs(prev => {
      const withoutRemoved = prev.filter(l => !toRemove.find(r => r.id === l.id))
      return [...newLabs, ...withoutRemoved]
    })

    toast.success(`Assigned to ${assignGrades.length || 1} grade(s)`)
    setAssignTarget(null)
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  function openEdit(lab: PhysicsLab) {
    setEditLab(lab)
    setEditGrade(lab.grade_id    || 'none')
    setEditSubject(lab.subject_id || 'none')
    setEditNote(lab.custom_note  || '')
    setEditActive(lab.is_active)
  }

  async function handleSaveEdit() {
    if (!editLab || !schoolId) return
    setSaving(true)
    const effectiveSchoolId = campusId || schoolId
    const res = await updateLab(editLab.id, {
      grade_id:    editGrade   !== 'none' ? editGrade   : null,
      subject_id:  editSubject !== 'none' ? editSubject : null,
      custom_note: editNote.trim() || null,
      is_active:   editActive,
    }, effectiveSchoolId)
    setSaving(false)
    if (!res.success) { toast.error(res.error || 'Failed to update'); return }
    toast.success(t('editDialog.save'))
    setAssignedLabs(prev => prev.map(l => l.id === editLab.id ? res.data! : l))
    setEditLab(null)
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget || !schoolId) return
    setDeleting(true)
    const res = await unassignLab(deleteTarget.id, campusId || schoolId)
    setDeleting(false)
    if (!res.success) { toast.error(res.error || 'Failed to remove'); return }
    toast.success(t('deleteDialog.confirm'))
    setAssignedLabs(prev => prev.filter(l => l.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  // ── Submissions ─────────────────────────────────────────────────────────────

  async function openSubmissions(lab: PhysicsLab) {
    if (!schoolId) return
    setSubmissionsLab(lab)
    setLoadingSubmissions(true)
    const res = await getLabSubmissions(lab.id, campusId || schoolId)
    if (res.success && res.data) setSubmissions(res.data)
    setLoadingSubmissions(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-4">
        <FlaskConical className="h-7 w-7 text-[#022172]" />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">
            {t('tabCatalog')} ({PHYSICS_CATALOG.length})
          </TabsTrigger>
          <TabsTrigger value="assigned">
            {t('tabAssigned')} ({assignedLabs.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Catalog Tab ── */}
        <TabsContent value="catalog" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('All')}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                activeCategory === 'All'
                  ? 'bg-[#022172] text-white border-[#022172]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#022172]'
              }`}
            >
              {t('allCategories')}
            </button>
            {SIM_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#022172] text-white border-[#022172]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#022172]'
                }`}
              >
                {catLabel(cat)}
              </button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {t('simulationsCount', { count: filteredCatalog.length })}
          </p>

          {/* Simulation grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map(sim => {
              const isAssigned = assignedKeys.has(sim.key)
              const simAssignments = assignedLabs.filter(l => l.sim_key === sim.key)
              const assignedGradeNames = simAssignments
                .map(l => l.grade_id ? grades.find(g => g.id === l.grade_id)?.name : t('allGrades'))
                .filter(Boolean) as string[]
              return (
                <Card key={sim.key} className={`flex flex-col ${isAssigned ? 'border-green-300 bg-green-50/40' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{simText(sim).title}</CardTitle>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[sim.category]}`}>
                        {simText(sim).category}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-3 pt-0">
                    <p className="text-sm text-muted-foreground flex-1">{simText(sim).description}</p>
                    <div className="flex flex-wrap gap-1">
                      {simText(sim).topics.slice(0, 3).map(topic => (
                        <Badge key={topic} variant="outline" className="text-xs">{topic}</Badge>
                      ))}
                    </div>
                    {assignedGradeNames.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {assignedGradeNames.map(name => (
                          <span key={name} className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            ✓ {name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        variant={isAssigned ? 'outline' : 'default'}
                        onClick={() => openAssign(sim)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {isAssigned ? t('assignAgain') : t('assign')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPreviewSim(sim)} title={t('preview')}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ── Assigned Tab ── */}
        <TabsContent value="assigned" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">{t('loading')}</p>
          ) : assignedLabs.length === 0 ? (
            <div className="text-center py-12">
              <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('emptyAssigned')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedLabs.map(lab => {
                const sim         = getCatalogEntry(lab.sim_key)
                const gradeLabel  = grades.find(g => g.id === lab.grade_id)?.name
                const subjectLabel = subjects.find(s => s.id === lab.subject_id)?.name
                return (
                  <Card key={lab.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{sim ? simText(sim).title : lab.sim_key}</span>
                        {sim && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[sim.category]}`}>
                            {simText(sim).category}
                          </span>
                        )}
                        {!lab.is_active && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {t('inactive')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-3">
                        <span>{t('gradeLabel', { name: gradeLabel || t('allGrades') })}</span>
                        {subjectLabel && <span>{t('subjectLabel', { name: subjectLabel })}</span>}
                        {lab.custom_note && (
                          <span className="truncate max-w-xs" title={lab.custom_note}>
                            {t('noteLabel', { text: lab.custom_note })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openSubmissions(lab)} title={t('viewSubmissions')}>
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(lab)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(lab)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Assign Dialog ── */}
      <Dialog open={!!assignTarget} onOpenChange={open => !open && setAssignTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('assignDialog.title', { title: assignTarget ? simText(assignTarget).title : '' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t('assignDialog.gradeLabel')}</Label>
                {assignGrades.length > 0 && (
                  <span className="text-xs text-muted-foreground">{assignGrades.length} selected</span>
                )}
              </div>
              {grades.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">{t('loading')}</p>
              ) : (
                <div className="max-h-44 overflow-y-auto border rounded-md divide-y">
                  {grades.map(g => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={assignGrades.includes(g.id)}
                        onCheckedChange={(checked) => toggleAssignGrade(g.id, !!checked)}
                      />
                      <span className="text-sm">{g.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t('assignDialog.subjectLabel')}</Label>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger><SelectValue placeholder={t('assignDialog.noSubject')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('assignDialog.noSubject')}</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('assignDialog.noteLabel')}</Label>
              <Textarea
                placeholder={t('assignDialog.notePlaceholder')}
                value={assignNote}
                onChange={e => setAssignNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>{t('assignDialog.cancel')}</Button>
            <Button onClick={handleAssign} disabled={assigning}>
              {assigning ? t('assignDialog.submitting') : t('assignDialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editLab} onOpenChange={open => !open && setEditLab(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('editDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('editDialog.gradeLabel')}</Label>
              <Select value={editGrade} onValueChange={setEditGrade}>
                <SelectTrigger><SelectValue placeholder={t('allGrades')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('allGrades')}</SelectItem>
                  {grades.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('editDialog.subjectLabel')}</Label>
              <Select value={editSubject} onValueChange={setEditSubject}>
                <SelectTrigger><SelectValue placeholder={t('assignDialog.noSubject')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('assignDialog.noSubject')}</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('editDialog.noteLabel')}</Label>
              <Textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editActive} onCheckedChange={setEditActive} id="edit-active" />
              <Label htmlFor="edit-active">{t('editDialog.activeLabel')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLab(null)}>{t('editDialog.cancel')}</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? t('editDialog.saving') : t('editDialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', {
                title: getCatalogEntry(deleteTarget?.sim_key || '')?.title || deleteTarget?.sim_key || ''
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t('deleteDialog.confirming') : t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Preview Fullscreen Overlay ── */}
      {previewSim && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Thin header bar */}
          <div className="flex items-center gap-2 px-4 h-10 border-b bg-gray-50 shrink-0">
            <FlaskConical className="h-4 w-4 text-[#022172]" />
            <span className="font-semibold text-sm">{previewSim.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[previewSim.category]}`}>
              {previewSim.category}
            </span>
            <button
              onClick={() => setPreviewSim(null)}
              className="ml-auto p-1 rounded hover:bg-gray-200 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          {/* iframe container — clips the myphysicslab.com branding row */}
          <div className="flex-1 overflow-hidden relative">
            <iframe
              key={previewSim.key}
              src={previewSim.url}
              title={previewSim.title}
              className="w-full border-none absolute inset-0"
              style={{ height: 'calc(100% + 36px)', marginTop: '-36px' }}
              sandbox="allow-scripts allow-same-origin"
              allow="fullscreen"
            />
          </div>
        </div>
      )}

      {/* ── Submissions Dialog ── */}
      <Dialog open={!!submissionsLab} onOpenChange={open => !open && setSubmissionsLab(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('submissionsDialog.title', {
                title: getCatalogEntry(submissionsLab?.sim_key || '')?.title || submissionsLab?.sim_key || ''
              })}
            </DialogTitle>
          </DialogHeader>
          {loadingSubmissions ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('submissionsDialog.loading')}</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('submissionsDialog.empty')}</p>
          ) : (
            <div className="space-y-3 py-2">
              {submissions.map(sub => {
                const p = sub.profiles as any
                const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Student' : 'Student'
                const gradeName = p?.grade_levels?.name as string | undefined
                const minutes = sub.time_spent_s ? Math.round(sub.time_spent_s / 60) : null
                return (
                  <div key={sub.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{name}</span>
                        {gradeName && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                            {gradeName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {minutes !== null && (
                          <span>{t('submissionsDialog.minLabel', { count: minutes })}</span>
                        )}
                        <span>{new Date(sub.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{sub.findings_text}</p>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
