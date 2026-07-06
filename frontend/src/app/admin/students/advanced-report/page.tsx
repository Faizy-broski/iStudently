"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter, Loader2, Users, GraduationCap, UserCheck, BookOpen, UserCircle, Search, X, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { getFieldDefinitions, CustomFieldDefinition, EntityType } from "@/lib/api/custom-fields"
import { getGradeLevels, getSections, GradeLevel, Section } from "@/lib/api/academics"
import { useCampus } from "@/context/CampusContext"
import { getAuthToken } from "@/lib/api/schools"
import { API_URL } from "@/config/api"

type ReportRole = 'student' | 'teacher' | 'staff' | 'librarian' | 'parent'

interface RoleConfig {
  icon: React.ReactNode
  entityType: EntityType | null
  standardFieldKeys: string[]
}

const ROLE_CONFIGS: Record<ReportRole, RoleConfig> = {
  student: {
    icon: <GraduationCap className="h-4 w-4" />,
    entityType: 'student',
    standardFieldKeys: ['student_number','first_name','last_name','father_name','grandfather_name','email','phone','grade_level_name','section_name','is_active','created_at'],
  },
  teacher: {
    icon: <UserCheck className="h-4 w-4" />,
    entityType: 'teacher',
    standardFieldKeys: ['employee_number','first_name','last_name','email','phone','title','department','qualifications','date_of_joining','employment_type','is_active','created_at'],
  },
  staff: {
    icon: <Users className="h-4 w-4" />,
    entityType: 'staff',
    standardFieldKeys: ['employee_number','first_name','last_name','email','phone','title','department','qualifications','date_of_joining','employment_type','is_active','created_at'],
  },
  librarian: {
    icon: <BookOpen className="h-4 w-4" />,
    entityType: null,
    standardFieldKeys: ['employee_number','first_name','last_name','email','phone','title','department','date_of_joining','employment_type','is_active','created_at'],
  },
  parent: {
    icon: <UserCircle className="h-4 w-4" />,
    entityType: 'parent',
    standardFieldKeys: ['first_name','last_name','email','phone','linked_students','is_active','created_at'],
  },
}

// ─── Person search combobox ───────────────────────────────────────────────────

interface PersonOption { id: string; label: string }

function PersonPicker({
  role,
  campusId,
  gradeLevelId,
  sectionId,
  department,
  value,
  onChange,
  placeholder,
  noFoundLabel,
}: {
  role: ReportRole
  campusId?: string
  gradeLevelId?: string
  sectionId?: string
  department?: string
  value: PersonOption | null
  onChange: (v: PersonOption | null) => void
  placeholder: string
  noFoundLabel: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<PersonOption[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const token = await getAuthToken()
        const qs = new URLSearchParams({ q: query })
        if (campusId) qs.set('campus_id', campusId)
        if (gradeLevelId) qs.set('grade_level_id', gradeLevelId)
        if (sectionId) qs.set('section_id', sectionId)
        if (department) qs.set('department', department)
        const res = await fetch(`${API_URL}/advanced-report/${role}/search?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        setResults(json.success ? json.data : [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [query, role, campusId, gradeLevelId, sectionId, department])

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-blue-50 dark:bg-slate-700 border-blue-200 dark:border-slate-600">
        <span className="text-sm flex-1 text-[#022172] dark:text-blue-300 font-medium">{value.label}</span>
        <button onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          className="pl-9"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              className="w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => { onChange(r); setOpen(false); setQuery('') }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {open && !searching && results.length === 0 && query.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg px-3 py-4 text-center text-sm text-muted-foreground">
          {noFoundLabel}
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdvancedReportPage() {
  const t = useTranslations('admin.reports.advanced_report')
  const router = useRouter()
  const { selectedCampus } = useCampus() ?? {}

  const [selectedRole, setSelectedRole] = useState<ReportRole>('student')
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [selectedFields, setSelectedFields] = useState<string[]>(['first_name', 'last_name', 'student_number'])
  const [loadingCustomFields, setLoadingCustomFields] = useState(false)

  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [department, setDepartment] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<PersonOption | null>(null)

  const roleConfig = ROLE_CONFIGS[selectedRole]
  const roleLabel = t(`roles.${selectedRole}`)

  const standardFields = useMemo(() =>
    roleConfig.standardFieldKeys.map(key => ({ id: key, label: t(`fields.${key}`) })),
    [roleConfig.standardFieldKeys, selectedRole]
  )

  useEffect(() => {
    if (selectedRole !== 'student') return
    setGrades([])
    setSelectedGradeId('')
    setSelectedSectionId('')
    getGradeLevels(selectedCampus?.id).then(res => {
      if (res.success && res.data) setGrades(res.data.filter(g => g.is_active))
    })
  }, [selectedRole, selectedCampus?.id])

  useEffect(() => {
    setSections([])
    setSelectedSectionId('')
    if (!selectedGradeId) return
    getSections(selectedGradeId, selectedCampus?.id).then(res => {
      if (res.success && res.data) setSections(res.data.filter(s => s.is_active))
    })
  }, [selectedGradeId, selectedCampus?.id])

  useEffect(() => {
    const entityType = ROLE_CONFIGS[selectedRole].entityType
    if (!entityType) { setCustomFields([]); return }
    setLoadingCustomFields(true)
    getFieldDefinitions(entityType, selectedCampus?.id)
      .then(res => { if (res.success && res.data) setCustomFields(res.data); else setCustomFields([]) })
      .catch(() => setCustomFields([]))
      .finally(() => setLoadingCustomFields(false))
  }, [selectedRole, selectedCampus?.id])

  const handleRoleChange = (role: ReportRole) => {
    setSelectedRole(role)
    setSelectedGradeId('')
    setSelectedSectionId('')
    setDepartment('')
    setSelectedPerson(null)
    setSelectedFields(ROLE_CONFIGS[role].standardFieldKeys.slice(0, 3))
  }

  const customFieldsByCategory = useMemo(() =>
    customFields.reduce((acc, field) => {
      if (!acc[field.category_name]) acc[field.category_name] = []
      acc[field.category_name].push(field)
      return acc
    }, {} as Record<string, CustomFieldDefinition[]>),
    [customFields]
  )

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    )
  }

  const toggleAll = (ids: string[]) => {
    const allSelected = ids.every(id => selectedFields.includes(id))
    setSelectedFields(prev =>
      allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    )
  }

  const generateReport = () => {
    if (selectedFields.length === 0) { toast.error(t('select_at_least_one')); return }
    const params = new URLSearchParams({ role: selectedRole, fields: JSON.stringify(selectedFields) })
    if (selectedCampus?.id) params.set('campus_id', selectedCampus.id)
    if (selectedPerson) {
      params.set('user_id', selectedPerson.id)
      params.set('user_label', selectedPerson.label)
    } else {
      if (selectedRole === 'student') {
        if (selectedGradeId) params.set('grade_level_id', selectedGradeId)
        if (selectedSectionId) params.set('section_id', selectedSectionId)
      }
      if (['teacher', 'staff', 'librarian'].includes(selectedRole) && department.trim()) {
        params.set('department', department.trim())
      }
    }
    router.push(`/admin/students/advanced-report/results?${params}`)
  }

  const activeFilters: string[] = []
  if (selectedPerson) {
    activeFilters.push(selectedPerson.label)
  } else {
    if (selectedGradeId) {
      const g = grades.find(x => x.id === selectedGradeId)
      activeFilters.push(`${t('grade_level')}: ${g?.name ?? selectedGradeId}`)
    }
    if (selectedSectionId) {
      const s = sections.find(x => x.id === selectedSectionId)
      activeFilters.push(`${t('section')}: ${s?.name ?? selectedSectionId}`)
    }
    if (department) activeFilters.push(`${t('department')}: ${department}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Role Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('select_user_type')}
          </CardTitle>
          <CardDescription>{t('select_user_type_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(ROLE_CONFIGS) as ReportRole[]).map(role => (
              <button
                key={role}
                onClick={() => handleRoleChange(role)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-sm font-medium
                  ${selectedRole === role
                    ? 'border-[#022172] bg-[#022172] text-white shadow-md scale-[1.02]'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#57A3CC] hover:bg-blue-50'
                  }`}
              >
                {ROLE_CONFIGS[role].icon}
                {t(`roles.${role}`)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            {t('filters')}
            {activeFilters.length > 0 && (
              <Badge className="bg-[#022172] text-white border-0">
                {t('active_filters', { count: activeFilters.length })}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{t('filters_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {selectedRole === 'student' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('grade_level')}</Label>
                <Select
                  value={selectedGradeId}
                  onValueChange={v => { setSelectedGradeId(v === '_all' ? '' : v); setSelectedSectionId('') }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('all_grades')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t('all_grades')}</SelectItem>
                    {grades.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('section')}</Label>
                <Select
                  value={selectedSectionId}
                  onValueChange={v => setSelectedSectionId(v === '_all' ? '' : v)}
                  disabled={!selectedGradeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedGradeId ? t('all_sections') : t('select_grade_first')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">{t('all_sections')}</SelectItem>
                    {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {['teacher', 'staff', 'librarian'].includes(selectedRole) && (
            <div className="space-y-1.5">
              <Label>{t('department')}</Label>
              <Input
                placeholder={t('department_placeholder')}
                value={department}
                onChange={e => setDepartment(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('or_target_person')}</span>
            <div className="flex-1 border-t" />
          </div>

          <div className="space-y-1.5">
            <Label>{t('specific_person')}</Label>
            <PersonPicker
              role={selectedRole}
              campusId={selectedCampus?.id}
              gradeLevelId={selectedRole === 'student' ? selectedGradeId : undefined}
              sectionId={selectedRole === 'student' ? selectedSectionId : undefined}
              department={['teacher', 'staff', 'librarian'].includes(selectedRole) ? department : undefined}
              value={selectedPerson}
              onChange={p => {
                setSelectedPerson(p)
                if (p) { setSelectedGradeId(''); setSelectedSectionId(''); setDepartment('') }
              }}
              placeholder={t('search_by_name', { role: roleLabel.toLowerCase() })}
              noFoundLabel={t('no_found', { role: roleLabel.toLowerCase() })}
            />
            <p className="text-xs text-muted-foreground">{t('person_hint')}</p>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(f => (
                <span key={f} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-[#022172] border border-blue-200 rounded-full">
                  {f}
                </span>
              ))}
              <button
                onClick={() => { setSelectedGradeId(''); setSelectedSectionId(''); setDepartment(''); setSelectedPerson(null) }}
                className="text-xs text-destructive hover:underline ml-1"
              >
                {t('clear_all')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Field Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('select_fields')}
            <Badge variant="secondary">{t('selected_count', { count: selectedFields.length })}</Badge>
          </CardTitle>
          <CardDescription>{t('select_fields_desc', { role: roleLabel })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#022172]">{t('standard_fields')}</h3>
              <Button variant="ghost" size="sm" onClick={() => toggleAll(standardFields.map(f => f.id))}>
                {standardFields.every(f => selectedFields.includes(f.id)) ? t('deselect_all') : t('select_all')}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {standardFields.map(field => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.id}
                    checked={selectedFields.includes(field.id)}
                    onCheckedChange={() => toggleField(field.id)}
                  />
                  <Label htmlFor={field.id} className="text-sm font-normal cursor-pointer">{field.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {loadingCustomFields ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading_custom')}
            </div>
          ) : Object.keys(customFieldsByCategory).length > 0 ? (
            Object.entries(customFieldsByCategory).map(([category, fields]) => {
              const ids = fields.map(f => `custom_${f.field_key}`)
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[#022172]">
                      {category.toUpperCase()}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{t('custom_label')}</span>
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => toggleAll(ids)}>
                      {ids.every(id => selectedFields.includes(id)) ? t('deselect_all') : t('select_all')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {fields.map(field => {
                      const fieldId = `custom_${field.field_key}`
                      return (
                        <div key={fieldId} className="flex items-center space-x-2">
                          <Checkbox
                            id={fieldId}
                            checked={selectedFields.includes(fieldId)}
                            onCheckedChange={() => toggleField(fieldId)}
                          />
                          <Label htmlFor={fieldId} className="text-sm font-normal cursor-pointer">{field.label}</Label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          ) : roleConfig.entityType ? (
            <p className="text-sm text-muted-foreground">{t('no_custom', { role: roleLabel })}</p>
          ) : null}

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {selectedFields.length === 0
                ? t('select_at_least_one')
                : t(selectedFields.length === 1 ? 'fields_selected' : 'fields_selected_plural', { count: selectedFields.length })}
              {activeFilters.length > 0 && (
                <span className="ml-2 text-[#022172] font-medium">· {activeFilters.join(', ')}</span>
              )}
            </p>
            <Button
              onClick={generateReport}
              disabled={selectedFields.length === 0}
              className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white"
            >
              {t('generate_btn', { role: roleLabel })} →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
