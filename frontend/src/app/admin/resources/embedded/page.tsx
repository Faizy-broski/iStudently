'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Minus, Save, Globe, ExternalLink, Loader2, Users, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCampus } from '@/context/CampusContext'
import * as embeddedApi from '@/lib/api/embedded-resources'
import * as academicsApi from '@/lib/api/academics'
import { getAllTeachers, type Staff } from '@/lib/api/teachers'
import { getStudents } from '@/lib/api/students'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RowState {
  id: string | 'new'
  title: string
  url: string
  visible_to_roles: string[]
  published_grade_ids: string[]
  published_section_ids: string[]
  visible_to_teacher_ids: string[]
  visible_to_student_ids: string[]
  dirty: boolean
}

interface GradeWithSections extends academicsApi.GradeLevel {
  sections: academicsApi.Section[]
}

interface StudentInfo { id: string; name: string }

const ALL_ROLES = ['admin', 'teacher', 'student', 'parent', 'librarian']
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', teacher: 'Teacher', student: 'Student',
  parent: 'Parent', librarian: 'Librarian',
}

function isValidUrl(v: string) {
  try { new URL(v); return true } catch { return false }
}

// ── Audience Popover ───────────────────────────────────────────────────────────

interface AudiencePopoverProps {
  row: RowState
  gradesWithSections: GradeWithSections[]
  teachers: Staff[]
  campusId: string
  onChange: (patch: Partial<RowState>) => void
}

function AudiencePopover({ row, gradesWithSections, teachers, campusId, onChange }: AudiencePopoverProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [sectionStudentsMap, setSectionStudentsMap] = useState<Record<string, StudentInfo[]>>({})
  const [loadingStudents, setLoadingStudents] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'roles' | 'students' | 'teachers'>('roles')

  // Clear student cache on campus change
  useEffect(() => { setSectionStudentsMap({}); setLoadingStudents(new Set()) }, [campusId])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const loadSectionStudents = useCallback(async (sectionId: string) => {
    if (sectionStudentsMap[sectionId] !== undefined) return
    if (loadingStudents.has(sectionId)) return
    setLoadingStudents(prev => new Set([...prev, sectionId]))
    const res = await getStudents({ section_id: sectionId, campus_id: campusId, limit: 200 })
    const students = (res.data || []).map(s => ({
      id: s.id,
      name: [s.medical_info?.first_name, s.medical_info?.last_name].filter(Boolean).join(' ') || s.student_number,
    }))
    setSectionStudentsMap(prev => ({ ...prev, [sectionId]: students }))
    setLoadingStudents(prev => { const n = new Set(prev); n.delete(sectionId); return n })
  }, [sectionStudentsMap, loadingStudents, campusId])

  const toggleRole = (role: string) => {
    const next = row.visible_to_roles.includes(role)
      ? row.visible_to_roles.filter(r => r !== role)
      : [...row.visible_to_roles, role]
    const patch: Partial<RowState> = { visible_to_roles: next }
    if (!next.includes('student') && !next.includes('parent')) {
      patch.published_grade_ids = []
      patch.published_section_ids = []
      patch.visible_to_student_ids = []
    }
    if (!next.includes('teacher')) patch.visible_to_teacher_ids = []
    onChange(patch)
  }

  const toggleGrade = (gid: string) => {
    const isDeselecting = row.published_grade_ids.includes(gid)
    const next = isDeselecting
      ? row.published_grade_ids.filter(id => id !== gid)
      : [...row.published_grade_ids, gid]

    const validSectionIds = gradesWithSections
      .filter(g => next.includes(g.id))
      .flatMap(g => g.sections.map(s => s.id))
    const validSectionSet = new Set(validSectionIds)

    // Clear student IDs belonging to sections of the deselected grade
    let newStudentIds = row.visible_to_student_ids
    if (isDeselecting) {
      const removedGrade = gradesWithSections.find(g => g.id === gid)
      if (removedGrade) {
        const removedSectionIds = new Set(removedGrade.sections.map(s => s.id))
        const removedStudentIds = new Set(
          Object.entries(sectionStudentsMap)
            .filter(([sid]) => removedSectionIds.has(sid))
            .flatMap(([, students]) => students.map(s => s.id))
        )
        newStudentIds = newStudentIds.filter(id => !removedStudentIds.has(id))
      }
    }

    onChange({
      published_grade_ids:    next,
      published_section_ids:  row.published_section_ids.filter(id => validSectionSet.has(id)),
      visible_to_student_ids: newStudentIds,
    })
  }

  const toggleSection = (sid: string) => {
    const isDeselecting = row.published_section_ids.includes(sid)
    const next = isDeselecting
      ? row.published_section_ids.filter(id => id !== sid)
      : [...row.published_section_ids, sid]

    let newStudentIds = row.visible_to_student_ids
    if (isDeselecting) {
      const removedStudentIds = new Set((sectionStudentsMap[sid] || []).map(s => s.id))
      newStudentIds = newStudentIds.filter(id => !removedStudentIds.has(id))
    } else {
      loadSectionStudents(sid)
    }

    onChange({ published_section_ids: next, visible_to_student_ids: newStudentIds })
  }

  const toggleStudent = (sid: string) => {
    const next = row.visible_to_student_ids.includes(sid)
      ? row.visible_to_student_ids.filter(id => id !== sid)
      : [...row.visible_to_student_ids, sid]
    onChange({ visible_to_student_ids: next })
  }

  const toggleTeacher = (tid: string) => {
    const next = row.visible_to_teacher_ids.includes(tid)
      ? row.visible_to_teacher_ids.filter(id => id !== tid)
      : [...row.visible_to_teacher_ids, tid]
    onChange({ visible_to_teacher_ids: next })
  }

  const hasStudentRole = row.visible_to_roles.includes('student')
  const hasParentRole = row.visible_to_roles.includes('parent')
  const showStudentSub = hasStudentRole || hasParentRole
  const showTeacherSub = row.visible_to_roles.includes('teacher')

  // Reset tab if role is unselected
  useEffect(() => {
    if (activeTab === 'students' && !showStudentSub) setActiveTab('roles')
    if (activeTab === 'teachers' && !showTeacherSub) setActiveTab('roles')
  }, [showStudentSub, showTeacherSub, activeTab])

  const summary = allRoles ? 'All roles' : row.visible_to_roles.map(r => ROLE_LABELS[r] ?? r).join(', ')

  const studentTabLabel = hasStudentRole && hasParentRole ? 'Students & Parents' 
                        : hasParentRole ? 'Parents' 
                        : 'Students'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-200 bg-white hover:border-blue-400 text-xs text-gray-700 w-full min-w-[140px] justify-between"
      >
        <span className="flex items-center gap-1 truncate">
          <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{summary}</span>
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-[360px] bg-white border rounded-lg shadow-xl p-0 overflow-hidden flex flex-col">
          {/* Tab Navigation */}
          <div className="flex border-b bg-gray-50 dark:bg-gray-800">
            <button 
              onClick={() => setActiveTab('roles')} 
              className={`flex-1 px-2 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'roles' ? 'border-blue-600 text-blue-700 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              Roles
            </button>
            {showStudentSub && (
              <button 
                onClick={() => setActiveTab('students')} 
                className={`flex-1 px-2 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'students' ? 'border-blue-600 text-blue-700 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                {studentTabLabel}
              </button>
            )}
            {showTeacherSub && (
              <button 
                onClick={() => setActiveTab('teachers')} 
                className={`flex-1 px-2 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'teachers' ? 'border-blue-600 text-blue-700 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                Teachers
              </button>
            )}
          </div>

          <div className="p-4 min-h-[200px]">
            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <div className="space-y-4">
                <p className="text-[11px] text-gray-500">Select which roles can access this resource.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ visible_to_roles: [], published_grade_ids: [], published_section_ids: [], visible_to_teacher_ids: [], visible_to_student_ids: [] })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${allRoles ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    All Roles
                  </button>
                  {ALL_ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${row.visible_to_roles.includes(role) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 dark:bg-gray-800 dark:text-gray-300'}`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Students/Parents Tab */}
            {activeTab === 'students' && showStudentSub && (
              <div className="space-y-3">
                <p className="text-[10px] text-gray-500 leading-tight">
                  {hasParentRole && !hasStudentRole 
                    ? "Empty = all parents. Select grade(s), section(s), or specific students to target their parents."
                    : hasStudentRole && hasParentRole
                    ? "Empty = all. Target specific students (and their parents) by grade, section, or individual."
                    : "Empty = all students. Select grade(s), section(s), or specific students to target individuals."}
                </p>
                {gradesWithSections.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No grades configured</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {gradesWithSections.map(grade => {
                      const gradeSelected = row.published_grade_ids.includes(grade.id)
                      return (
                        <div key={grade.id} className="border rounded-md p-2 bg-gray-50 dark:bg-gray-800/50">
                          {/* Grade toggle */}
                          <button
                            type="button"
                            onClick={() => toggleGrade(grade.id)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-colors ${gradeSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'}`}
                          >
                            {grade.name}
                          </button>

                          {/* Sections within grade */}
                          {gradeSelected && grade.sections.length > 0 && (
                            <div className="ml-2 mt-2 space-y-2 border-l-2 border-indigo-100 pl-2">
                              <div className="flex flex-wrap gap-1.5">
                                {grade.sections.map(sec => {
                                  const secSelected = row.published_section_ids.includes(sec.id)
                                  return (
                                    <button
                                      key={sec.id}
                                      type="button"
                                      onClick={() => toggleSection(sec.id)}
                                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${secSelected ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white border-gray-300 text-gray-600 hover:border-teal-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'}`}
                                    >
                                      {sec.name}
                                    </button>
                                  )
                                })}
                              </div>

                              {/* Students within each selected section */}
                              {grade.sections.filter(sec => row.published_section_ids.includes(sec.id)).map(sec => (
                                <div key={`students-${sec.id}`} className="mt-1.5 p-2 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800">
                                  <p className="text-[10px] text-gray-400 mb-1.5 font-medium">
                                    {sec.name} — specific students (empty = all):
                                  </p>
                                  {loadingStudents.has(sec.id) ? (
                                    <p className="text-[10px] text-gray-400 italic">Loading…</p>
                                  ) : (sectionStudentsMap[sec.id] || []).length === 0 ? (
                                    <p className="text-[10px] text-gray-400 italic">No students found</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {(sectionStudentsMap[sec.id] || []).map(student => {
                                        const sel = row.visible_to_student_ids.includes(student.id)
                                        return (
                                          <button
                                            key={student.id}
                                            type="button"
                                            onClick={() => toggleStudent(student.id)}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${sel ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-orange-400 dark:bg-gray-800 dark:border-gray-700'}`}
                                          >
                                            {student.name}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Teacher sub-filter */}
            {activeTab === 'teachers' && showTeacherSub && (
              <div className="space-y-3">
                <p className="text-[10px] text-gray-500">Empty = all teachers. Select specific teachers to restrict access.</p>
                {teachers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No teachers found</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {teachers.map(t => {
                      const name = `${t.profile?.first_name ?? ''} ${t.profile?.last_name ?? ''}`.trim() || t.employee_number
                      const sel = row.visible_to_teacher_ids.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTeacher(t.id)}
                          className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors border ${sel ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:bg-amber-50 hover:border-amber-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t p-2 bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full text-xs font-semibold text-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Audience Summary Badges ────────────────────────────────────────────────────

function AudienceSummaryBadges({ row, gradesWithSections, teachers }: {
  row: RowState
  gradesWithSections: GradeWithSections[]
  teachers: Staff[]
}) {
  const badges: { label: string; color: string }[] = []

  if (row.visible_to_roles.length === 0) {
    badges.push({ label: 'All roles', color: 'bg-gray-100 text-gray-600' })
  } else {
    for (const role of row.visible_to_roles) {
      badges.push({ label: ROLE_LABELS[role] ?? role, color: 'bg-blue-100 text-blue-700' })
    }
  }

  if (row.visible_to_student_ids.length > 0) {
    badges.push({ label: `${row.visible_to_student_ids.length} student${row.visible_to_student_ids.length !== 1 ? 's' : ''}`, color: 'bg-orange-100 text-orange-700' })
  } else if (row.published_section_ids.length > 0) {
    const names = gradesWithSections.flatMap(g => g.sections).filter(s => row.published_section_ids.includes(s.id)).map(s => s.name)
    names.forEach(n => badges.push({ label: `§ ${n}`, color: 'bg-teal-100 text-teal-700' }))
  } else if (row.published_grade_ids.length > 0) {
    const names = gradesWithSections.filter(g => row.published_grade_ids.includes(g.id)).map(g => g.name)
    names.forEach(n => badges.push({ label: n, color: 'bg-indigo-100 text-indigo-700' }))
  }

  if (row.visible_to_teacher_ids.length > 0) {
    const names = teachers.filter(t => row.visible_to_teacher_ids.includes(t.id))
      .map(t => `${t.profile?.first_name ?? ''} ${t.profile?.last_name ?? ''}`.trim() || t.employee_number)
    names.forEach(n => badges.push({ label: `👤 ${n}`, color: 'bg-amber-100 text-amber-700' }))
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {badges.map((b, i) => (
        <span key={i} className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${b.color}`}>{b.label}</span>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EmbeddedResourcesPage() {
  const campusCtx     = useCampus()
  const selectedCampus = campusCtx?.selectedCampus

  const [rows,               setRows]               = useState<RowState[]>([])
  const [gradesWithSections, setGradesWithSections] = useState<GradeWithSections[]>([])
  const [teachers,           setTeachers]           = useState<Staff[]>([])
  const [loading,            setLoading]            = useState(true)
  const [saving,             setSaving]             = useState(false)
  const [deleteTarget,       setDeleteTarget]       = useState<string | null>(null)

  // ── Data loading ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!selectedCampus) return
    setLoading(true)

    // Fetch grades, resources, teachers in parallel; then fetch sections per grade
    const [resourcesRes, gradesRes, teachersRes] = await Promise.all([
      embeddedApi.getEmbeddedResources(selectedCampus.id),
      academicsApi.getGradeLevels(selectedCampus.id),
      getAllTeachers({ campus_id: selectedCampus.id, limit: 200 }),
    ])

    if (resourcesRes.success && resourcesRes.data) {
      setRows(resourcesRes.data.map(r => ({
        id:                     r.id,
        title:                  r.title,
        url:                    r.url,
        visible_to_roles:       r.visible_to_roles       || [],
        published_grade_ids:    r.published_grade_ids    || [],
        published_section_ids:  r.published_section_ids  || [],
        visible_to_teacher_ids: r.visible_to_teacher_ids || [],
        visible_to_student_ids: r.visible_to_student_ids || [],
        dirty: false,
      })))
    } else {
      toast.error(resourcesRes.error || 'Failed to load resources')
    }

    const grades = [...(gradesRes.data || [])].sort((a, b) => a.order_index - b.order_index)

    // Fetch sections per grade for reliable field names (uses get_sections_by_grade RPC)
    const sectionsArrays = await Promise.all(
      grades.map(g => academicsApi.getSections(g.id, selectedCampus.id))
    )
    const gws: GradeWithSections[] = grades.map((g, i) => ({
      ...g,
      sections: sectionsArrays[i].data || [],
    }))
    setGradesWithSections(gws)
    setTeachers(teachersRes.data || [])
    setLoading(false)
  }, [selectedCampus])

  useEffect(() => { if (selectedCampus) fetchData() }, [selectedCampus, fetchData])

  // ── Row mutations ───────────────────────────────────────────────────────────

  const updateRow = (id: string | 'new', patch: Partial<RowState>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch, dirty: true } : r))
  }

  const addNewRow = () => {
    if (rows.some(r => r.id === 'new')) return
    setRows(prev => [...prev, {
      id: 'new', title: '', url: '',
      visible_to_roles: [], published_grade_ids: [], published_section_ids: [],
      visible_to_teacher_ids: [], visible_to_student_ids: [],
      dirty: true,
    }])
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveAll = async () => {
    const dirty = rows.filter(r => r.dirty)
    if (dirty.length === 0) { toast.info('No changes to save'); return }

    for (const r of dirty) {
      if (r.id !== 'new') {
        if (!r.title.trim()) { toast.error('Title cannot be empty'); return }
        if (!r.url.trim() || !isValidUrl(r.url)) { toast.error(`Invalid URL: ${r.url}`); return }
      }
    }

    setSaving(true)
    let hadError = false

    for (const r of dirty) {
      const payload = {
        title:                  r.title,
        url:                    r.url,
        visible_to_roles:       r.visible_to_roles,
        published_grade_ids:    r.published_grade_ids,
        published_section_ids:  r.published_section_ids,
        visible_to_teacher_ids: r.visible_to_teacher_ids,
        visible_to_student_ids: r.visible_to_student_ids,
      }

      if (r.id === 'new') {
        if (!r.title.trim() || !r.url.trim()) continue
        if (!isValidUrl(r.url)) { toast.error(`Invalid URL: ${r.url}`); hadError = true; continue }
        const res = await embeddedApi.createEmbeddedResource({ ...payload, campus_id: selectedCampus?.id })
        if (!res.success) { toast.error(res.error || 'Create failed'); hadError = true }
      } else {
        const res = await embeddedApi.updateEmbeddedResource(r.id, payload, selectedCampus?.id)
        if (!res.success) { toast.error(res.error || 'Update failed'); hadError = true }
      }
    }

    setSaving(false)
    if (!hadError) toast.success('Saved successfully')
    await fetchData()
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const res = await embeddedApi.deleteEmbeddedResource(deleteTarget, selectedCampus?.id)
    if (res.success) {
      toast.success('Deleted')
      setRows(prev => prev.filter(r => r.id !== deleteTarget))
    } else {
      toast.error(res.error || 'Delete failed')
    }
    setDeleteTarget(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Globe className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Embedded Resources</h1>
            <p className="text-sm text-gray-500">Add external websites with granular audience targeting</p>
          </div>
        </div>
        <Button onClick={saveAll} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-300">
        Add external websites. Use the <strong>Audience</strong> column to control which roles, grades, sections,
        specific students, or teachers can see each resource.
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-visible">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 text-left font-semibold text-blue-600 uppercase text-xs tracking-wide w-48">Title</th>
                <th className="px-4 py-3 text-left font-semibold text-blue-600 uppercase text-xs tracking-wide">Link</th>
                <th className="px-4 py-3 text-left font-semibold text-blue-600 uppercase text-xs tracking-wide w-72">Audience</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors align-top">
                  {/* Delete */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => row.id === 'new' ? setRows(p => p.filter(r => r.id !== 'new')) : setDeleteTarget(row.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors mt-0.5"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <Input
                      value={row.title}
                      onChange={e => updateRow(row.id, { title: e.target.value })}
                      placeholder="Resource title"
                      maxLength={60}
                      className="h-8 text-sm"
                    />
                  </td>

                  {/* URL */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.url && row.id !== 'new' && (
                        <a href={row.url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Link
                        </a>
                      )}
                      <Input
                        value={row.url}
                        onChange={e => updateRow(row.id, { url: e.target.value })}
                        placeholder="https://..."
                        className="h-8 text-sm flex-1"
                      />
                    </div>
                  </td>

                  {/* Audience */}
                  <td className="px-4 py-3">
                    <AudiencePopover
                      row={row}
                      gradesWithSections={gradesWithSections}
                      teachers={teachers}
                      campusId={selectedCampus?.id ?? ''}
                      onChange={patch => updateRow(row.id, patch)}
                    />
                    <AudienceSummaryBadges row={row} gradesWithSections={gradesWithSections} teachers={teachers} />
                  </td>
                </tr>
              ))}

              {/* Add row */}
              {!rows.some(r => r.id === 'new') && (
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={addNewRow}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-400 italic">Add a new resource…</td>
                </tr>
              )}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400 italic">No embedded resources yet. Click + to add one.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom save */}
      <div className="flex justify-center">
        <Button onClick={saveAll} disabled={saving} size="lg" className="gap-2 px-10">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
