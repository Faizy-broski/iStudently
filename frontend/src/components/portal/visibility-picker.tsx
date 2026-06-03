"use client"

import { useState, useEffect, useCallback, useMemo, startTransition } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Loader2, X, Search,
  Users, GraduationCap, UserCheck, Eye,
} from "lucide-react"
import { getGradeLevels, getSections, type GradeLevel, type Section } from "@/lib/api/academics"
import { getStudentsForAssign, type StudentForAssign } from "@/lib/api/billing-elements"
import { getAllStaff } from "@/lib/api/staff"

// ─── Types ──────────────────────────────────────────────────────────────────

export type VisibilityMode = 'roles' | 'students' | 'staff'

export interface VisibilityState {
  mode: VisibilityMode
  roles: string[]
  userIds: string[]
  gradeIds: string[]
}

interface SelectedPerson {
  id: string
  name: string
  tag: string
}

interface VisibilityPickerProps {
  value: VisibilityState
  onChange: (value: VisibilityState) => void
  schoolId: string
  campusId?: string
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
]

// ─── Summary label ──────────────────────────────────────────────────────────

function getVisibilitySummary(value: VisibilityState): string {
  if (value.mode === 'roles') {
    if (value.roles.length === 0 || value.roles.length === 4) return 'All Roles'
    return value.roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')
  }
  if (value.mode === 'students') {
    if (value.userIds.length === 0) return 'No students selected'
    return `${value.userIds.length} student${value.userIds.length !== 1 ? 's' : ''}`
  }
  if (value.mode === 'staff') {
    if (value.userIds.length === 0) return 'No staff selected'
    return `${value.userIds.length} staff member${value.userIds.length !== 1 ? 's' : ''}`
  }
  return 'All Roles'
}

// ─── Component ──────────────────────────────────────────────────────────────

export function VisibilityPicker({ value, onChange, schoolId, campusId }: VisibilityPickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<VisibilityState>(value)

  // Grades & Sections for filter dropdowns
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [allSections, setAllSections] = useState<Section[]>([])
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [loadingSections, setLoadingSections] = useState(false)

  // All students (flat list)
  const [allStudents, setAllStudents] = useState<StudentForAssign[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Filters for students
  const [studentGradeFilter, setStudentGradeFilter] = useState<string>('all')
  const [studentSectionFilter, setStudentSectionFilter] = useState<string>('all')
  const [studentSearch, setStudentSearch] = useState('')

  // Staff list
  const [staffList, setStaffList] = useState<SelectedPerson[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')

  // Selected people map for badge display
  const [selectedPeople, setSelectedPeople] = useState<Map<string, SelectedPerson>>(new Map())

  // The backend grade/section RPCs expect campus_id, not school_id
  const effectiveId = campusId || schoolId

  // ─── Load grades + sections + all students when dialog opens ──
  useEffect(() => {
    if (!open || !effectiveId) return
    // Load grades if not loaded
    if (grades.length === 0 && !loadingGrades) {
      startTransition(() => setLoadingGrades(true))
      getGradeLevels(effectiveId)
        .then((res) => {
          if (Array.isArray(res?.data)) setGrades(res.data)
        })
        .catch(() => {})
        .finally(() => setLoadingGrades(false))
    }
    // Load all sections if not loaded
    if (allSections.length === 0 && !loadingSections) {
      startTransition(() => setLoadingSections(true))
      getSections(undefined, effectiveId)
        .then((res) => {
          if (Array.isArray(res?.data)) setAllSections(res.data)
        })
        .catch(() => {})
        .finally(() => setLoadingSections(false))
    }
    // Load all students if not loaded
    if (allStudents.length === 0 && !loadingStudents) {
      startTransition(() => setLoadingStudents(true))
      getStudentsForAssign()
        .then((studs) => {
          setAllStudents(Array.isArray(studs) ? studs : [])
        })
        .catch(() => {})
        .finally(() => setLoadingStudents(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, effectiveId])

  // ─── Load staff when staff tab is active ──────
  useEffect(() => {
    if (!open || draft.mode !== 'staff' || staffList.length > 0 || loadingStaff) return
    startTransition(() => setLoadingStaff(true))
    getAllStaff(1, 200, undefined, 'employees', campusId)
      .then((res) => {
        const list: SelectedPerson[] = []
        const rawData = res as Record<string, unknown>
        const inner = rawData?.data as Record<string, unknown> | undefined
        const items = inner?.data
        if (Array.isArray(items)) {
          items.forEach((s: Record<string, unknown>) => {
            const profile = s.profile as Record<string, string> | undefined
            const firstName = profile?.first_name || (s.first_name as string) || ''
            const lastName = profile?.last_name || (s.last_name as string) || ''
            const name = `${firstName} ${lastName}`.trim() || profile?.email || 'Staff'
            const role = (s.role as string) || (s.employment_type as string) || 'staff'
            list.push({
              id: (s.profile_id as string) || (s.id as string),
              name,
              tag: role.charAt(0).toUpperCase() + role.slice(1),
            })
          })
        }
        setStaffList(list)
      })
      .catch(() => {})
      .finally(() => setLoadingStaff(false))
  }, [open, draft.mode, campusId, staffList.length, loadingStaff])

  // ─── Sync draft when dialog opens ───────────
  const openDialog = useCallback(() => {
    setDraft(value)
    setOpen(true)
  }, [value])

  const applyAndClose = useCallback(() => {
    onChange(draft)
    setOpen(false)
  }, [draft, onChange])

  // ─── Sections filtered by selected grade ─────
  const sectionsForFilter = useMemo(() => {
    if (studentGradeFilter === 'all') return allSections
    return allSections.filter((s) => s.grade_level_id === studentGradeFilter)
  }, [allSections, studentGradeFilter])

  // Reset section filter when grade filter changes
  useEffect(() => {
    setStudentSectionFilter('all')
  }, [studentGradeFilter])

  // ─── Filtered students ────────────────────────
  const filteredStudents = useMemo(() => {
    let filtered = allStudents

    if (studentGradeFilter !== 'all') {
      filtered = filtered.filter((s) => s.grade_level_id === studentGradeFilter)
    }
    if (studentSectionFilter !== 'all') {
      filtered = filtered.filter((s) => s.section_id === studentSectionFilter)
    }
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase()
      filtered = filtered.filter((s) => {
        const name = (s.name || `${s.first_name} ${s.last_name}`).toLowerCase()
        const adm = s.admission_number?.toLowerCase() || ''
        return name.includes(q) || adm.includes(q)
      })
    }
    return filtered
  }, [allStudents, studentGradeFilter, studentSectionFilter, studentSearch])

  // ─── Role toggle ─────────────────────────────
  const toggleRole = (role: string) => {
    const newRoles = draft.roles.includes(role)
      ? draft.roles.filter((r) => r !== role)
      : [...draft.roles, role]
    setDraft({ ...draft, roles: newRoles })
  }

  // ─── Person toggle (student or staff) ─────────
  const togglePerson = (person: SelectedPerson) => {
    const isSelected = draft.userIds.includes(person.id)
    const newIds = isSelected
      ? draft.userIds.filter((id) => id !== person.id)
      : [...draft.userIds, person.id]

    const newPeople = new Map(selectedPeople)
    if (!isSelected) {
      newPeople.set(person.id, person)
    } else {
      newPeople.delete(person.id)
    }
    setSelectedPeople(newPeople)
    setDraft({ ...draft, userIds: newIds })
  }

  // ─── Remove from badges ──────────────────────
  const removePerson = (id: string) => {
    const newPeople = new Map(selectedPeople)
    newPeople.delete(id)
    setSelectedPeople(newPeople)
    setDraft({ ...draft, userIds: draft.userIds.filter((uid) => uid !== id) })
  }

  // ─── Select / deselect all currently visible (filtered) students ──────
  const toggleAllFilteredStudents = () => {
    const filteredIds = new Set(filteredStudents.map((s) => s.id))
    const allSelected = filteredStudents.every((s) => draft.userIds.includes(s.id))
    const newPeople = new Map(selectedPeople)
    let newIds: string[]

    if (allSelected) {
      newIds = draft.userIds.filter((id) => !filteredIds.has(id))
      filteredStudents.forEach((s) => newPeople.delete(s.id))
    } else {
      newIds = [...draft.userIds]
      filteredStudents.forEach((s) => {
        if (!newIds.includes(s.id)) {
          newIds.push(s.id)
        }
        newPeople.set(s.id, {
          id: s.id,
          name: s.name || `${s.first_name} ${s.last_name}`.trim(),
          tag: `${s.grade_level || ''} - ${s.section_name || ''}`.replace(/^ - $/, ''),
        })
      })
    }

    setSelectedPeople(newPeople)
    setDraft({ ...draft, userIds: newIds })
  }

  // ─── Select / deselect all staff ──────────────
  const toggleAllStaff = () => {
    const allSelected = staffList.every((s) => draft.userIds.includes(s.id))
    const newPeople = new Map(selectedPeople)
    let newIds: string[]

    if (allSelected) {
      const staffIds = new Set(staffList.map((s) => s.id))
      newIds = draft.userIds.filter((id) => !staffIds.has(id))
      staffList.forEach((s) => newPeople.delete(s.id))
    } else {
      newIds = [...draft.userIds]
      staffList.forEach((s) => {
        if (!newIds.includes(s.id)) newIds.push(s.id)
        newPeople.set(s.id, s)
      })
    }

    setSelectedPeople(newPeople)
    setDraft({ ...draft, userIds: newIds })
  }

  // ─── Filtered staff ──────────────────────────
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staffList
    const q = staffSearch.toLowerCase()
    return staffList.filter((s) =>
      s.name.toLowerCase().includes(q) || s.tag.toLowerCase().includes(q)
    )
  }, [staffList, staffSearch])

  const summary = getVisibilitySummary(value)
  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((s) => draft.userIds.includes(s.id))

  return (
    <>
      {/* Trigger Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs justify-start gap-1.5 w-full font-normal border-gray-300"
        onClick={openDialog}
      >
        <Eye className="h-3 w-3 text-gray-500 shrink-0" />
        <span className="truncate">{summary}</span>
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-[#022172]" />
              Visibility Settings
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <Tabs
              value={draft.mode}
              onValueChange={(v) => setDraft({ ...draft, mode: v as VisibilityMode })}
              className="w-full flex flex-col flex-1 min-h-0"
            >
              <TabsList className="h-9 p-1 w-full grid grid-cols-3 mb-3 shrink-0">
                <TabsTrigger value="roles" className="text-xs gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Roles
                </TabsTrigger>
                <TabsTrigger value="students" className="text-xs gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Students
                </TabsTrigger>
                <TabsTrigger value="staff" className="text-xs gap-1.5">
                  <UserCheck className="h-3.5 w-3.5" />
                  Staff
                </TabsTrigger>
              </TabsList>

              {/* ── Roles Tab ─────────────────────────── */}
              <TabsContent value="roles" className="mt-0">
                <p className="text-xs text-gray-500 mb-3">
                  Select which roles can see this item. If none selected, all roles can see it.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((role) => (
                    <label
                      key={role.value}
                      className="flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Checkbox
                        checked={draft.roles.includes(role.value)}
                        onCheckedChange={() => toggleRole(role.value)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{role.label}</span>
                    </label>
                  ))}
                </div>
                {draft.roles.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">No roles selected — defaults to all roles</p>
                )}
              </TabsContent>

              {/* ── Students Tab ──────────────────────── */}
              <TabsContent value="students" className="mt-0 flex flex-col min-h-0 flex-1">
                {/* Selected students badges */}
                {draft.userIds.length > 0 && draft.mode === 'students' && (
                  <div className="flex flex-wrap gap-1 mb-3 p-2 bg-blue-50/50 border border-blue-100 rounded-lg shrink-0">
                    <span className="text-xs text-gray-500 w-full mb-1 font-medium">
                      {draft.userIds.length} selected:
                    </span>
                    {Array.from(selectedPeople.values())
                      .filter((p) => draft.userIds.includes(p.id))
                      .slice(0, 15)
                      .map((person) => (
                        <Badge key={person.id} variant="secondary" className="text-[10px] h-5 gap-0.5 pr-1">
                          {person.name}
                          <button type="button" className="ml-0.5 hover:text-red-600" onClick={() => removePerson(person.id)}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    {draft.userIds.length > 15 && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        +{draft.userIds.length - 15} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Filters row */}
                <div className="flex items-center gap-2 mb-2 shrink-0 flex-wrap">
                  {/* Grade filter */}
                  <Select value={studentGradeFilter} onValueChange={setStudentGradeFilter}>
                    <SelectTrigger className="h-8 text-xs w-36 border-gray-300">
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Grades</SelectItem>
                      {grades.map((g) => (
                        <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Section filter — only show when a grade is picked */}
                  {studentGradeFilter !== 'all' && (
                    <Select value={studentSectionFilter} onValueChange={setStudentSectionFilter}>
                      <SelectTrigger className="h-8 text-xs w-36 border-gray-300">
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Sections</SelectItem>
                        {sectionsForFilter.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Search */}
                  <div className="relative flex-1 min-w-32">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search name / admission #"
                      className="h-8 text-xs pl-8 border-gray-300"
                    />
                  </div>

                  {/* Select all filtered */}
                  {filteredStudents.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px] shrink-0"
                      onClick={toggleAllFilteredStudents}
                    >
                      {allFilteredSelected ? 'Deselect All' : `Select All (${filteredStudents.length})`}
                    </Button>
                  )}
                </div>

                {/* Student list */}
                {loadingStudents || loadingGrades ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
                  </div>
                ) : allStudents.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-6 text-center">No students found</p>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-6 text-center">No students match the current filters</p>
                ) : (
                  <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0">
                    {filteredStudents.map((student) => {
                      const studentName = student.name || `${student.first_name} ${student.last_name}`.trim()
                      return (
                        <label
                          key={student.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={draft.userIds.includes(student.id)}
                            onCheckedChange={() =>
                              togglePerson({
                                id: student.id,
                                name: studentName,
                                tag: `${student.grade_level || ''} - ${student.section_name || ''}`.replace(/^ - $/, ''),
                              })
                            }
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="truncate">{studentName}</span>
                          {student.admission_number && (
                            <span className="text-[10px] text-gray-400 shrink-0">
                              #{student.admission_number}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                            {student.grade_level}{student.section_name ? ` - ${student.section_name}` : ''}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── Staff Tab ─────────────────────────── */}
              <TabsContent value="staff" className="mt-0 flex flex-col min-h-0 flex-1">
                {/* Selected staff badges */}
                {draft.userIds.length > 0 && draft.mode === 'staff' && (
                  <div className="flex flex-wrap gap-1 mb-3 p-2 bg-blue-50/50 border border-blue-100 rounded-lg shrink-0">
                    <span className="text-xs text-gray-500 w-full mb-1 font-medium">
                      {draft.userIds.length} selected:
                    </span>
                    {Array.from(selectedPeople.values())
                      .filter((p) => draft.userIds.includes(p.id))
                      .slice(0, 12)
                      .map((person) => (
                        <Badge key={person.id} variant="secondary" className="text-[10px] h-5 gap-0.5 pr-1">
                          {person.name}
                          <button type="button" className="ml-0.5 hover:text-red-600" onClick={() => removePerson(person.id)}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    {draft.userIds.length > 12 && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        +{draft.userIds.length - 12} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Search + Select All */}
                <div className="flex items-center gap-2 mb-2 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      placeholder="Search staff..."
                      className="h-8 text-xs pl-8 border-gray-300"
                    />
                  </div>
                  {staffList.length > 0 && !staffSearch && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px] shrink-0"
                      onClick={toggleAllStaff}
                    >
                      {staffList.every((s) => draft.userIds.includes(s.id)) ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>

                {/* Staff list */}
                {loadingStaff ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading staff...
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-6 text-center">
                    {staffSearch ? 'No matching staff' : 'No staff found'}
                  </p>
                ) : (
                  <div className="flex-1 overflow-y-auto border rounded-lg divide-y min-h-0">
                    {filteredStaff.map((person) => (
                      <label
                        key={person.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                      >
                        <Checkbox
                          checked={draft.userIds.includes(person.id)}
                          onCheckedChange={() => togglePerson(person)}
                          className="h-4 w-4"
                        />
                        <span className="truncate">{person.name}</span>
                        <Badge variant="outline" className="text-[10px] h-5 ml-auto shrink-0">
                          {person.tag}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="mt-3 gap-2 sm:gap-0 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#022172] hover:bg-[#022172]/90"
              onClick={applyAndClose}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
