'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Minus, Search, Link2, Loader2, Save, X, Users, ChevronDown, Tags, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getResourceLinks, bulkSaveResourceLinks } from '@/lib/api/resource-links'
import {
  getResourceLinkCategories,
  createResourceLinkCategory,
  updateResourceLinkCategory,
  deleteResourceLinkCategory,
  type ResourceLinkCategory,
} from '@/lib/api/resource-link-categories'
import * as academicsApi from '@/lib/api/academics'
import { getAllTeachers, type Staff } from '@/lib/api/teachers'
import { getStudents } from '@/lib/api/students'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EditableLink {
  id?: string
  title: string
  url: string
  visible_to: string[]
  visible_to_grade_ids: string[]
  visible_to_section_ids: string[]
  visible_to_teacher_ids: string[]
  visible_to_student_ids: string[]
  sort_order: number
  category_id: string | null
  isNew?: boolean
}

interface GradeWithSections extends academicsApi.GradeLevel {
  sections: academicsApi.Section[]
}

interface StudentInfo { id: string; name: string }

const ALL_ROLES = ['admin', 'teacher', 'student', 'parent', 'librarian']
const ROLE_COLORS: Record<string, string> = {
  admin:     'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  teacher:   'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  student:   'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
  parent:    'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  librarian: 'bg-rose-100   text-rose-700   dark:bg-rose-900/40   dark:text-rose-300',
}

type T = ReturnType<typeof useTranslations>

// ── Audience Popover ───────────────────────────────────────────────────────────

interface AudiencePopoverProps {
  link: EditableLink
  gradesWithSections: GradeWithSections[]
  teachers: Staff[]
  campusId: string
  t: T
  onChange: (patch: Partial<EditableLink>) => void
}

function AudiencePopover({ link, gradesWithSections, teachers, campusId, t, onChange }: AudiencePopoverProps) {
  const roleLabels: Record<string, string> = {
    admin: t('role_admin'), teacher: t('role_teacher'), student: t('role_student'),
    parent: t('role_parent'), librarian: t('role_librarian'),
  }
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
    const next = link.visible_to.includes(role)
      ? link.visible_to.filter(r => r !== role)
      : [...link.visible_to, role]
    const patch: Partial<EditableLink> = { visible_to: next }
    if (!next.includes('student') && !next.includes('parent')) {
      patch.visible_to_grade_ids = []
      patch.visible_to_section_ids = []
      patch.visible_to_student_ids = []
    }
    if (!next.includes('teacher')) patch.visible_to_teacher_ids = []
    onChange(patch)
  }

  const toggleGrade = (gid: string) => {
    const isDeselecting = link.visible_to_grade_ids.includes(gid)
    const next = isDeselecting
      ? link.visible_to_grade_ids.filter(id => id !== gid)
      : [...link.visible_to_grade_ids, gid]

    const validSectionSet = new Set(
      gradesWithSections.filter(g => next.includes(g.id)).flatMap(g => g.sections.map(s => s.id))
    )

    let newStudentIds = link.visible_to_student_ids
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
      visible_to_grade_ids:   next,
      visible_to_section_ids: link.visible_to_section_ids.filter(id => validSectionSet.has(id)),
      visible_to_student_ids: newStudentIds,
    })
  }

  const toggleSection = (sid: string) => {
    const isDeselecting = link.visible_to_section_ids.includes(sid)
    const next = isDeselecting
      ? link.visible_to_section_ids.filter(id => id !== sid)
      : [...link.visible_to_section_ids, sid]

    let newStudentIds = link.visible_to_student_ids
    if (isDeselecting) {
      const removedStudentIds = new Set((sectionStudentsMap[sid] || []).map(s => s.id))
      newStudentIds = newStudentIds.filter(id => !removedStudentIds.has(id))
    } else {
      loadSectionStudents(sid)
    }

    onChange({ visible_to_section_ids: next, visible_to_student_ids: newStudentIds })
  }

  const toggleStudent = (sid: string) => {
    const next = link.visible_to_student_ids.includes(sid)
      ? link.visible_to_student_ids.filter(id => id !== sid)
      : [...link.visible_to_student_ids, sid]
    onChange({ visible_to_student_ids: next })
  }

  const toggleTeacher = (tid: string) => {
    const next = link.visible_to_teacher_ids.includes(tid)
      ? link.visible_to_teacher_ids.filter(id => id !== tid)
      : [...link.visible_to_teacher_ids, tid]
    onChange({ visible_to_teacher_ids: next })
  }

  const hasStudentRole = link.visible_to.includes('student')
  const hasParentRole = link.visible_to.includes('parent')
  const showStudentSub = hasStudentRole || hasParentRole
  const showTeacherSub = link.visible_to.includes('teacher')

  // Reset tab if role is unselected
  useEffect(() => {
    if (activeTab === 'students' && !showStudentSub) setActiveTab('roles')
    if (activeTab === 'teachers' && !showTeacherSub) setActiveTab('roles')
  }, [showStudentSub, showTeacherSub, activeTab])

  const summary = link.visible_to.length === 0
    ? t('no_one')
    : link.visible_to.map(r => roleLabels[r] ?? r).join(', ')

  const studentTabLabel = hasStudentRole && hasParentRole ? t('tab_students_parents')
                        : hasParentRole ? t('tab_parents')
                        : t('tab_students')

  return (
    <div className="relative" ref={ref}>
      {/* Trigger — selected roles as removable badges */}
      <div
        className="flex flex-wrap items-center gap-1 min-h-9 px-2 py-1.5 border rounded-md cursor-pointer bg-background hover:border-blue-400 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {link.visible_to.length === 0 ? (
          <span className="text-muted-foreground text-xs px-1">{t('select_roles')}</span>
        ) : (
          link.visible_to.map(role => (
            <Badge
              key={role}
              className={`flex items-center gap-1 text-xs border-0 ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'}`}
            >
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onChange({ visible_to: link.visible_to.filter(r => r !== role) }) }}
                className="hover:opacity-70"
              >
                <X className="h-2.5 w-2.5" />
              </button>
              {roleLabels[role] ?? role}
            </Badge>
          ))
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground ms-auto shrink-0" />
      </div>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-[360px] bg-white dark:bg-gray-900 border rounded-lg shadow-xl p-0 overflow-hidden flex flex-col">
          {/* Tab Navigation */}
          <div className="flex border-b bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex-1 px-2 py-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'roles' ? 'border-blue-600 text-blue-700 bg-white dark:bg-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {t('tab_roles')}
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
                {t('tab_teachers')}
              </button>
            )}
          </div>

          <div className="p-4 min-h-[200px]">
            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <div className="space-y-4">
                <p className="text-[11px] text-gray-500">{t('audience_roles_help')}</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        link.visible_to.includes(role)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {roleLabels[role]}
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
                    ? t('audience_parents_help')
                    : hasStudentRole && hasParentRole
                    ? t('audience_students_parents_help')
                    : t('audience_students_help')}
                </p>
                {gradesWithSections.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">{t('no_grades_configured')}</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {gradesWithSections.map(grade => {
                      const gradeSelected = link.visible_to_grade_ids.includes(grade.id)
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
                                  const secSelected = link.visible_to_section_ids.includes(sec.id)
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
                              {grade.sections.filter(sec => link.visible_to_section_ids.includes(sec.id)).map(sec => (
                                <div key={`students-${sec.id}`} className="mt-1.5 p-2 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800">
                                  <p className="text-[10px] text-gray-400 mb-1.5 font-medium">
                                    {t('section_students_label', { section: sec.name })}
                                  </p>
                                  {loadingStudents.has(sec.id) ? (
                                    <p className="text-[10px] text-gray-400 italic">{t('loading_students')}</p>
                                  ) : (sectionStudentsMap[sec.id] || []).length === 0 ? (
                                    <p className="text-[10px] text-gray-400 italic">{t('no_students_found')}</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {(sectionStudentsMap[sec.id] || []).map(student => {
                                        const sel = link.visible_to_student_ids.includes(student.id)
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
                <p className="text-[10px] text-gray-500">{t('audience_teachers_help')}</p>
                {teachers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">{t('no_teachers_found')}</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {teachers.map(teacher => {
                      const name = `${teacher.profile?.first_name ?? ''} ${teacher.profile?.last_name ?? ''}`.trim() || teacher.employee_number
                      const sel = link.visible_to_teacher_ids.includes(teacher.id)
                      return (
                        <button
                          key={teacher.id}
                          type="button"
                          onClick={() => toggleTeacher(teacher.id)}
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
              {t('done')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-filter summary badges ──────────────────────────────────────────────────

function SubFilterBadges({ link, gradesWithSections, teachers }: {
  link: EditableLink
  gradesWithSections: GradeWithSections[]
  teachers: Staff[]
}) {
  const items: { label: string; color: string }[] = []

  if (link.visible_to_student_ids.length > 0) {
    items.push({ label: `${link.visible_to_student_ids.length} student${link.visible_to_student_ids.length !== 1 ? 's' : ''}`, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' })
  } else if (link.visible_to_section_ids.length > 0) {
    const names = gradesWithSections.flatMap(g => g.sections)
      .filter(s => link.visible_to_section_ids.includes(s.id))
      .map(s => s.name)
    names.forEach(n => items.push({ label: `§ ${n}`, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' }))
  } else if (link.visible_to_grade_ids.length > 0) {
    const names = gradesWithSections.filter(g => link.visible_to_grade_ids.includes(g.id)).map(g => g.name)
    names.forEach(n => items.push({ label: n, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' }))
  }

  if (link.visible_to_teacher_ids.length > 0) {
    const names = teachers
      .filter(t => link.visible_to_teacher_ids.includes(t.id))
      .map(t => `${t.profile?.first_name ?? ''} ${t.profile?.last_name ?? ''}`.trim() || t.employee_number)
    names.forEach(n => items.push({ label: `👤 ${n}`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }))
  }

  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.map((item, i) => (
        <span key={i} className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${item.color}`}>
          {item.label}
        </span>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ResourceLinksPage() {
  useAuth()
  const campusCtx      = useCampus()
  const selectedCampus = campusCtx?.selectedCampus
  const t = useTranslations('school.resources.links')

  const [editableLinks,      setEditableLinks]      = useState<EditableLink[]>([])
  const [initialized,        setInitialized]        = useState(false)
  const [saving,             setSaving]             = useState(false)
  const [searchQuery,        setSearchQuery]        = useState('')
  const [deleteIdx,          setDeleteIdx]          = useState<number | null>(null)
  const [gradesWithSections, setGradesWithSections] = useState<GradeWithSections[]>([])
  const [teachers,           setTeachers]           = useState<Staff[]>([])
  const [categories,         setCategories]         = useState<ResourceLinkCategory[]>([])
  const [categoryFilter,     setCategoryFilter]     = useState<string>('all')
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false)
  const [newCategoryName,    setNewCategoryName]    = useState('')
  const [savingCategory,     setSavingCategory]     = useState(false)
  const [editingCategoryId,  setEditingCategoryId]  = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  // ── Load categories ─────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    const data = await getResourceLinkCategories(selectedCampus?.id)
    setCategories(data)
  }, [selectedCampus?.id])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  // ── Load lookup data ────────────────────────────────────────────────────────

  const fetchLookups = useCallback(async () => {
    if (!selectedCampus) return

    const [gradesRes, teachersRes] = await Promise.all([
      academicsApi.getGradeLevels(selectedCampus.id),
      getAllTeachers({ campus_id: selectedCampus.id, limit: 200 }),
    ])

    const grades = [...(gradesRes.data || [])].sort((a, b) => a.order_index - b.order_index)

    // Fetch sections per grade for reliable field names (uses get_sections_by_grade RPC)
    const sectionsArrays = await Promise.all(
      grades.map(g => academicsApi.getSections(g.id, selectedCampus.id))
    )
    setGradesWithSections(grades.map((g, i) => ({
      ...g,
      sections: sectionsArrays[i].data || [],
    })))
    setTeachers(teachersRes.data || [])
  }, [selectedCampus])

  useEffect(() => { fetchLookups() }, [fetchLookups])

  // ── Load links ──────────────────────────────────────────────────────────────

  const cacheKey = ['resource-links', selectedCampus?.id]

  const { data: serverLinks, isLoading } = useSWR(
    cacheKey,
    () => getResourceLinks(selectedCampus?.id),
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (!initialized) {
          setEditableLinks(data.map(l => ({
            id:                     l.id,
            title:                  l.title,
            url:                    l.url,
            visible_to:             l.visible_to             || [],
            visible_to_grade_ids:   l.visible_to_grade_ids   || [],
            visible_to_section_ids: l.visible_to_section_ids || [],
            visible_to_teacher_ids: l.visible_to_teacher_ids || [],
            visible_to_student_ids: l.visible_to_student_ids || [],
            sort_order:             l.sort_order ?? 0,
            category_id:            l.category_id ?? null,
          })))
          setInitialized(true)
        }
      },
    }
  )

  useEffect(() => { setInitialized(false); setEditableLinks([]) }, [selectedCampus?.id])

  // ── Search filter ───────────────────────────────────────────────────────────

  const filteredLinks = useMemo(() => {
    let result = editableLinks
    if (categoryFilter !== 'all') {
      result = result.filter(l => l.category_id === categoryFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(l => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
    }
    return result
  }, [editableLinks, searchQuery, categoryFilter])

  // ── Mutations ───────────────────────────────────────────────────────────────

  const addNew = () => setEditableLinks(prev => [
    ...prev,
    {
      title: '', url: '', visible_to: ['admin'], visible_to_grade_ids: [], visible_to_section_ids: [],
      visible_to_teacher_ids: [], visible_to_student_ids: [], sort_order: prev.length + 1, category_id: null, isNew: true,
    },
  ])

  const updateLink = (idx: number, patch: Partial<EditableLink>) => {
    const target = filteredLinks[idx]
    setEditableLinks(prev => prev.map(l => l === target ? { ...l, ...patch } : l))
  }

  const handleDelete = () => {
    if (deleteIdx === null) return
    const target = filteredLinks[deleteIdx]
    setEditableLinks(prev => prev.filter(l => l !== target))
    setDeleteIdx(null)
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    for (const link of editableLinks) {
      if (!link.title.trim()) { toast.error(t('msg_all_required')); return }
      if (!link.url.trim())   { toast.error(t('msg_url_required')); return }
    }

    setSaving(true)
    try {
      const existingIds = (serverLinks || []).map(l => l.id)
      await bulkSaveResourceLinks(
        editableLinks.map((l, i) => ({
          id:                     l.id,
          title:                  l.title.trim(),
          url:                    l.url.trim(),
          visible_to:             l.visible_to,
          visible_to_grade_ids:   l.visible_to_grade_ids,
          visible_to_section_ids: l.visible_to_section_ids,
          visible_to_teacher_ids: l.visible_to_teacher_ids,
          visible_to_student_ids: l.visible_to_student_ids,
          sort_order:             l.sort_order ?? i + 1,
          category_id:            l.category_id,
        })),
        existingIds
      )
      setInitialized(false)
      mutate(cacheKey)
      toast.success(t('msg_save_success'))
    } catch {
      toast.error(t('msg_save_error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    setSavingCategory(true)
    try {
      const created = await createResourceLinkCategory({
        name: newCategoryName.trim(),
        campus_id: selectedCampus?.id,
        sort_order: categories.length,
      })
      if (!created) { toast.error(t('msg_category_error')); return }
      setNewCategoryName('')
      await fetchCategories()
    } finally {
      setSavingCategory(false)
    }
  }

  const startEditCategory = (cat: ResourceLinkCategory) => {
    setEditingCategoryId(cat.id)
    setEditingCategoryName(cat.name)
  }

  const handleRenameCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return
    setSavingCategory(true)
    try {
      const updated = await updateResourceLinkCategory(editingCategoryId, { name: editingCategoryName.trim() })
      if (!updated) { toast.error(t('msg_category_error')); return }
      setEditingCategoryId(null)
      setEditingCategoryName('')
      await fetchCategories()
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    const ok = await deleteResourceLinkCategory(id)
    if (!ok) { toast.error(t('msg_category_error')); return }
    if (categoryFilter === id) setCategoryFilter('all')
    setEditableLinks(prev => prev.map(l => l.category_id === id ? { ...l, category_id: null } : l))
    await fetchCategories()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white flex items-center gap-2">
            <Link2 className="h-7 w-7" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setManageCategoriesOpen(true)}>
            <Tags className="h-4 w-4 mr-2" />
            {t('manage_categories')}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#008B8B] hover:bg-[#007070] text-white">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('saving_button')}</> : <><Save className="h-4 w-4 mr-2" />{t('save_button')}</>}
          </Button>
        </div>
      </div>

      {/* Card */}
      <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm overflow-visible">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm text-muted-foreground">
            {isLoading ? t('loading') : `${editableLinks.length} ${t('resource')}${editableLinks.length !== 1 ? 's' : ''}`}
          </span>
          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder={t('all_categories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_categories')}</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search_placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[0,1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="overflow-visible">
            <table className="w-full text-sm">
              <TableHeader>
                <TableRow className="bg-gray-900 hover:bg-gray-900">
                  <TableHead className="w-10 text-white" />
                  <TableHead className="text-white font-semibold w-20">{t('th_order')}</TableHead>
                  <TableHead className="text-white font-semibold w-44">{t('th_title')}</TableHead>
                  <TableHead className="text-white font-semibold">{t('th_link')}</TableHead>
                  <TableHead className="text-white font-semibold w-44">{t('th_category')}</TableHead>
                  <TableHead className="text-white font-semibold w-72">{t('th_visible_to')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((link, idx) => (
                  <TableRow key={link.id || `new-${idx}`} className="align-top">
                    {/* Delete */}
                    <TableCell className="text-center pt-3">
                      <button
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setDeleteIdx(idx)}
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                    </TableCell>

                    {/* Order */}
                    <TableCell className="pt-2.5">
                      <Input
                        type="number"
                        value={link.sort_order}
                        onChange={e => updateLink(idx, { sort_order: parseInt(e.target.value, 10) || 0 })}
                        className="w-16"
                      />
                    </TableCell>

                    {/* Title */}
                    <TableCell className="pt-2.5">
                      <Input
                        value={link.title}
                        onChange={e => updateLink(idx, { title: e.target.value })}
                        placeholder={t('resource_name_placeholder')}
                        className="max-w-xs"
                      />
                    </TableCell>

                    {/* URL */}
                    <TableCell className="pt-2.5">
                      <Input
                        value={link.url}
                        onChange={e => updateLink(idx, { url: e.target.value })}
                        placeholder={t('url_placeholder')}
                        className="max-w-md"
                      />
                    </TableCell>

                    {/* Category */}
                    <TableCell className="pt-2.5">
                      <Select
                        value={link.category_id ?? '__none__'}
                        onValueChange={v => updateLink(idx, { category_id: v === '__none__' ? null : v })}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder={t('no_category')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('no_category')}</SelectItem>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Audience */}
                    <TableCell className="pt-2.5 pb-3">
                      <AudiencePopover
                        link={link}
                        gradesWithSections={gradesWithSections}
                        teachers={teachers}
                        campusId={selectedCampus?.id ?? ''}
                        t={t}
                        onChange={patch => updateLink(idx, patch)}
                      />
                      <SubFilterBadges
                        link={link}
                        gradesWithSections={gradesWithSections}
                        teachers={teachers}
                      />
                    </TableCell>
                  </TableRow>
                ))}

                {/* Add row */}
                <TableRow>
                  <TableCell className="text-center">
                    <button className="text-green-600 hover:text-green-800" onClick={addNew}>
                      <Plus className="h-5 w-5" />
                    </button>
                  </TableCell>
                  <TableCell colSpan={5} className="text-muted-foreground text-sm italic">
                    {t('add_row_prompt')}
                  </TableCell>
                </TableRow>
              </TableBody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteIdx(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-80 space-y-4" onClick={e => e.stopPropagation()}>
            <p className="font-semibold">{t('delete_confirm_title')}</p>
            <p className="text-sm text-muted-foreground">{t('delete_cannot_undo')}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteIdx(null)}>{t('cancel')}</Button>
              <Button variant="destructive" onClick={handleDelete}>{t('btn_delete')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories */}
      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('manage_categories')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={t('new_category_placeholder')}
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
              />
              <Button onClick={handleAddCategory} disabled={savingCategory || !newCategoryName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('no_categories_yet')}</p>
              )}
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 border rounded-md px-2 py-1.5">
                  {editingCategoryId === cat.id ? (
                    <>
                      <Input
                        value={editingCategoryName}
                        onChange={e => setEditingCategoryName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory() }}
                        className="h-8"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleRenameCategory} disabled={savingCategory}>{t('save_button')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{cat.name}</span>
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => startEditCategory(cat)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button className="text-red-500 hover:text-red-700" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
