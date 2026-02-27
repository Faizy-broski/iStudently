'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as api from '@/lib/api/human-resources'
import type {
  HRSkill, HREducation, HRCertification, HRLanguage, ILRLevel
} from '@/lib/api/human-resources'
import { ILR_LABELS } from '@/lib/api/human-resources'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, GraduationCap, Award, Languages, Wrench } from 'lucide-react'

// ============================================================================
// ILR Level Select
// ============================================================================

const ILR_OPTIONS: ILRLevel[] = [
  'ILR_Level_1', 'ILR_Level_2', 'ILR_Level_3', 'ILR_Level_4', 'ILR_Level_5'
]

function ILRSelect({
  value, onChange, label
}: { value: ILRLevel | null | undefined; onChange: (v: ILRLevel | null) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select
        value={value || '__none__'}
        onValueChange={(v) => onChange(v === '__none__' ? null : v as ILRLevel)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="N/A" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">N/A</SelectItem>
          {ILR_OPTIONS.map((lvl) => (
            <SelectItem key={lvl} value={lvl} className="text-xs">
              {ILR_LABELS[lvl]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ============================================================================
// Generic section row
// ============================================================================

function SectionHeader({
  title, icon: Icon, onAdd
}: { title: string; icon: React.ElementType; onAdd: () => void }) {
  return (
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
  )
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="text-xs text-muted-foreground text-center py-4">
      No {label.toLowerCase()} found.
    </p>
  )
}

function ActionButtons({
  onEdit, onDelete
}: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1 shrink-0">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
        <Pencil className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface Props { profileId: string }

export function QualificationsTab({ profileId }: Props) {
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const { data, isLoading, mutate } = useSWR(
    profileId && schoolId ? ['hr-qualifications', profileId, schoolId] : null,
    () => api.getQualifications(profileId, schoolId)
  )

  const quals = data?.data

  // ---- SKILL state ----
  const [skillDialog, setSkillDialog] = useState(false)
  const [editSkill, setEditSkill] = useState<HRSkill | null>(null)
  const [skillForm, setSkillForm] = useState({ title: '', description: '' })
  const [savingSkill, setSavingSkill] = useState(false)

  const openSkillDialog = (item?: HRSkill) => {
    setEditSkill(item || null)
    setSkillForm({ title: item?.title || '', description: item?.description || '' })
    setSkillDialog(true)
  }

  const saveSkill = async () => {
    if (!skillForm.title.trim()) return toast.error('Skill title is required')
    setSavingSkill(true)
    const res = editSkill
      ? await api.updateSkill(editSkill.id, skillForm)
      : await api.createSkill({
          school_id: schoolId, campus_id: campusId, profile_id: profileId, ...skillForm
        })
    setSavingSkill(false)
    if (res.error) return toast.error(res.error)
    toast.success(editSkill ? 'Skill updated' : 'Skill added')
    mutate()
    setSkillDialog(false)
  }

  const removeSkill = useCallback(async (id: string) => {
    if (!confirm('Delete this skill?')) return
    const res = await api.deleteSkill(id)
    if (res.error) toast.error(res.error)
    else { toast.success('Skill deleted'); mutate() }
  }, [mutate])

  // ---- EDUCATION state ----
  const [eduDialog, setEduDialog] = useState(false)
  const [editEdu, setEditEdu] = useState<HREducation | null>(null)
  const [eduForm, setEduForm] = useState({ qualification: '', institute: '', start_date: '', completed_on: '' })
  const [savingEdu, setSavingEdu] = useState(false)

  const openEduDialog = (item?: HREducation) => {
    setEditEdu(item || null)
    setEduForm({
      qualification: item?.qualification || '',
      institute: item?.institute || '',
      start_date: item?.start_date || '',
      completed_on: item?.completed_on || '',
    })
    setEduDialog(true)
  }

  const saveEdu = async () => {
    if (!eduForm.qualification.trim()) return toast.error('Qualification is required')
    setSavingEdu(true)
    const payload = {
      qualification: eduForm.qualification,
      institute: eduForm.institute || null,
      start_date: eduForm.start_date || null,
      completed_on: eduForm.completed_on || null,
    }
    const res = editEdu
      ? await api.updateEducation(editEdu.id, payload)
      : await api.createEducation({
          school_id: schoolId, campus_id: campusId, profile_id: profileId, ...payload
        })
    setSavingEdu(false)
    if (res.error) return toast.error(res.error)
    toast.success(editEdu ? 'Education updated' : 'Education added')
    mutate()
    setEduDialog(false)
  }

  const removeEdu = useCallback(async (id: string) => {
    if (!confirm('Delete this education record?')) return
    const res = await api.deleteEducation(id)
    if (res.error) toast.error(res.error)
    else { toast.success('Deleted'); mutate() }
  }, [mutate])

  // ---- CERTIFICATION state ----
  const [certDialog, setCertDialog] = useState(false)
  const [editCert, setEditCert] = useState<HRCertification | null>(null)
  const [certForm, setCertForm] = useState({ title: '', institute: '', granted_on: '', valid_through: '' })
  const [savingCert, setSavingCert] = useState(false)

  const openCertDialog = (item?: HRCertification) => {
    setEditCert(item || null)
    setCertForm({
      title: item?.title || '',
      institute: item?.institute || '',
      granted_on: item?.granted_on || '',
      valid_through: item?.valid_through || '',
    })
    setCertDialog(true)
  }

  const saveCert = async () => {
    if (!certForm.title.trim()) return toast.error('Certification title is required')
    setSavingCert(true)
    const payload = {
      title: certForm.title,
      institute: certForm.institute || null,
      granted_on: certForm.granted_on || null,
      valid_through: certForm.valid_through || null,
    }
    const res = editCert
      ? await api.updateCertification(editCert.id, payload)
      : await api.createCertification({
          school_id: schoolId, campus_id: campusId, profile_id: profileId, ...payload
        })
    setSavingCert(false)
    if (res.error) return toast.error(res.error)
    toast.success(editCert ? 'Certification updated' : 'Certification added')
    mutate()
    setCertDialog(false)
  }

  const removeCert = useCallback(async (id: string) => {
    if (!confirm('Delete this certification?')) return
    const res = await api.deleteCertification(id)
    if (res.error) toast.error(res.error)
    else { toast.success('Deleted'); mutate() }
  }, [mutate])

  // ---- LANGUAGE state ----
  const [langDialog, setLangDialog] = useState(false)
  const [editLang, setEditLang] = useState<HRLanguage | null>(null)
  const [langForm, setLangForm] = useState<{
    title: string
    reading: ILRLevel | null
    speaking: ILRLevel | null
    writing: ILRLevel | null
  }>({ title: '', reading: null, speaking: null, writing: null })
  const [savingLang, setSavingLang] = useState(false)

  const openLangDialog = (item?: HRLanguage) => {
    setEditLang(item || null)
    setLangForm({
      title: item?.title || '',
      reading: item?.reading || null,
      speaking: item?.speaking || null,
      writing: item?.writing || null,
    })
    setLangDialog(true)
  }

  const saveLang = async () => {
    if (!langForm.title.trim()) return toast.error('Language name is required')
    setSavingLang(true)
    const res = editLang
      ? await api.updateLanguage(editLang.id, langForm)
      : await api.createLanguage({
          school_id: schoolId, campus_id: campusId, profile_id: profileId, ...langForm
        })
    setSavingLang(false)
    if (res.error) return toast.error(res.error)
    toast.success(editLang ? 'Language updated' : 'Language added')
    mutate()
    setLangDialog(false)
  }

  const removeLang = useCallback(async (id: string) => {
    if (!confirm('Delete this language?')) return
    const res = await api.deleteLanguage(id)
    if (res.error) toast.error(res.error)
    else { toast.success('Deleted'); mutate() }
  }, [mutate])

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ---- SKILLS ---- */}
      <Card>
        <SectionHeader title="Skills" icon={Wrench} onAdd={() => openSkillDialog()} />
        <CardContent>
          {!quals?.skills.length ? (
            <EmptyRow label="Skills" />
          ) : (
            <div className="space-y-2">
              {quals.skills.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-2 p-2 rounded-md border text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.title}</p>
                    {s.description && (
                      <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                    )}
                  </div>
                  <ActionButtons onEdit={() => openSkillDialog(s)} onDelete={() => removeSkill(s.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- EDUCATION ---- */}
      <Card>
        <SectionHeader title="Education" icon={GraduationCap} onAdd={() => openEduDialog()} />
        <CardContent>
          {!quals?.education.length ? (
            <EmptyRow label="Education records" />
          ) : (
            <div className="space-y-2">
              {quals.education.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-2 p-2 rounded-md border text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium truncate">{e.qualification}</p>
                    {e.institute && (
                      <p className="text-xs text-muted-foreground truncate">{e.institute}</p>
                    )}
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {e.start_date && <span>{formatDate(e.start_date)}</span>}
                      {e.start_date && e.completed_on && <span>→</span>}
                      {e.completed_on && <span>{formatDate(e.completed_on)}</span>}
                    </div>
                  </div>
                  <ActionButtons onEdit={() => openEduDialog(e)} onDelete={() => removeEdu(e.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- CERTIFICATIONS ---- */}
      <Card>
        <SectionHeader title="Certifications" icon={Award} onAdd={() => openCertDialog()} />
        <CardContent>
          {!quals?.certifications.length ? (
            <EmptyRow label="Certifications" />
          ) : (
            <div className="space-y-2">
              {quals.certifications.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 p-2 rounded-md border text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium truncate">{c.title}</p>
                    {c.institute && (
                      <p className="text-xs text-muted-foreground truncate">{c.institute}</p>
                    )}
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      {c.granted_on && (
                        <span>Granted: {formatDate(c.granted_on)}</span>
                      )}
                      {c.valid_through && (
                        <span className="flex items-center gap-1">
                          Valid through: {formatDate(c.valid_through)}
                          {c.valid_through && new Date(c.valid_through) < new Date() && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-red-300 text-red-600">
                              Expired
                            </Badge>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <ActionButtons onEdit={() => openCertDialog(c)} onDelete={() => removeCert(c.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- LANGUAGES ---- */}
      <Card>
        <SectionHeader title="Languages" icon={Languages} onAdd={() => openLangDialog()} />
        <CardContent>
          {!quals?.languages.length ? (
            <EmptyRow label="Languages" />
          ) : (
            <div className="space-y-2">
              {quals.languages.map((l) => (
                <div key={l.id} className="flex items-start justify-between gap-2 p-2 rounded-md border text-sm">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{l.title}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {l.reading && (
                        <span>
                          <span className="font-medium text-foreground">R:</span>{' '}
                          {ILR_LABELS[l.reading]}
                        </span>
                      )}
                      {l.speaking && (
                        <span>
                          <span className="font-medium text-foreground">S:</span>{' '}
                          {ILR_LABELS[l.speaking]}
                        </span>
                      )}
                      {l.writing && (
                        <span>
                          <span className="font-medium text-foreground">W:</span>{' '}
                          {ILR_LABELS[l.writing]}
                        </span>
                      )}
                    </div>
                  </div>
                  <ActionButtons onEdit={() => openLangDialog(l)} onDelete={() => removeLang(l.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======== DIALOGS ======== */}

      {/* Skill Dialog */}
      <Dialog open={skillDialog} onOpenChange={(o) => !savingSkill && setSkillDialog(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editSkill ? 'Edit Skill' : 'Add Skill'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Skill <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. HTML, Python, Leadership…"
                value={skillForm.title}
                onChange={(e) => setSkillForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description…"
                rows={2}
                value={skillForm.description}
                onChange={(e) => setSkillForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkillDialog(false)}>Cancel</Button>
            <Button onClick={saveSkill} disabled={savingSkill}>
              {savingSkill ? 'Saving…' : editSkill ? 'Save Changes' : 'Add Skill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Education Dialog */}
      <Dialog open={eduDialog} onOpenChange={(o) => !savingEdu && setEduDialog(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editEdu ? 'Edit Education' : 'Add Education'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Qualification <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Bachelor of Science…"
                value={eduForm.qualification}
                onChange={(e) => setEduForm((f) => ({ ...f, qualification: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Institute</Label>
              <Input
                placeholder="e.g. MIT, Harvard…"
                value={eduForm.institute}
                onChange={(e) => setEduForm((f) => ({ ...f, institute: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={eduForm.start_date}
                  onChange={(e) => setEduForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Completed On</Label>
                <Input
                  type="date"
                  value={eduForm.completed_on}
                  onChange={(e) => setEduForm((f) => ({ ...f, completed_on: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEduDialog(false)}>Cancel</Button>
            <Button onClick={saveEdu} disabled={savingEdu}>
              {savingEdu ? 'Saving…' : editEdu ? 'Save Changes' : 'Add Education'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={certDialog} onOpenChange={(o) => !savingCert && setCertDialog(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCert ? 'Edit Certification' : 'Add Certification'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Certification <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. PMP, AWS Solutions Architect…"
                value={certForm.title}
                onChange={(e) => setCertForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Institute / Issuer</Label>
              <Input
                placeholder="e.g. PMI, Amazon…"
                value={certForm.institute}
                onChange={(e) => setCertForm((f) => ({ ...f, institute: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Granted On</Label>
                <Input
                  type="date"
                  value={certForm.granted_on}
                  onChange={(e) => setCertForm((f) => ({ ...f, granted_on: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Through</Label>
                <Input
                  type="date"
                  value={certForm.valid_through}
                  onChange={(e) => setCertForm((f) => ({ ...f, valid_through: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertDialog(false)}>Cancel</Button>
            <Button onClick={saveCert} disabled={savingCert}>
              {savingCert ? 'Saving…' : editCert ? 'Save Changes' : 'Add Certification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Language Dialog */}
      <Dialog open={langDialog} onOpenChange={(o) => !savingLang && setLangDialog(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editLang ? 'Edit Language' : 'Add Language'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Language <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. English, French, Arabic…"
                value={langForm.title}
                onChange={(e) => setLangForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <ILRSelect
              label="Reading"
              value={langForm.reading}
              onChange={(v) => setLangForm((f) => ({ ...f, reading: v }))}
            />
            <ILRSelect
              label="Speaking"
              value={langForm.speaking}
              onChange={(v) => setLangForm((f) => ({ ...f, speaking: v }))}
            />
            <ILRSelect
              label="Writing"
              value={langForm.writing}
              onChange={(v) => setLangForm((f) => ({ ...f, writing: v }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLangDialog(false)}>Cancel</Button>
            <Button onClick={saveLang} disabled={savingLang}>
              {savingLang ? 'Saving…' : editLang ? 'Save Changes' : 'Add Language'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
