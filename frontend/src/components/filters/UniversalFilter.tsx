'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useGradeLevels } from '@/hooks/useAcademics'
import { getSections } from '@/lib/api/academics'
import type { Section, GradeLevel } from '@/lib/api/academics'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterState {
  search?: string
  gradeId?: string     // grade_level UUID — used for section cascade
  gradeName?: string   // grade name string — used by student API
  sectionId?: string
  role?: string        // 'all' | 'teacher' | 'staff' | 'librarian' | 'counselor'
}

export type AvailableFilter = 'search' | 'grade' | 'section' | 'role'

const STAFF_ROLES = ['teacher', 'staff', 'librarian', 'counselor'] as const

interface UniversalFilterProps {
  availableFilters: AvailableFilter[]
  onFilterChange: (filters: FilterState) => void
  currentFilters?: FilterState
  entityType?: 'students' | 'staff' | 'teachers' | 'all'
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UniversalFilter({
  availableFilters,
  onFilterChange,
  currentFilters,
  entityType = 'all',
  className,
}: UniversalFilterProps) {
  const t = useTranslations('filters')

  // Local state
  const [search, setSearch] = useState(currentFilters?.search ?? '')
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState(currentFilters?.sectionId ?? '')
  const [selectedRole, setSelectedRole] = useState(currentFilters?.role ?? '')
  const [sections, setSections] = useState<Section[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 500)

  const { gradeLevels, isLoading: gradesLoading } = useGradeLevels()

  // ── Cascade: load sections when grade changes ──────────────────────────────

  useEffect(() => {
    if (!selectedGrade) {
      setSections([])
      return
    }
    setSectionsLoading(true)
    getSections(selectedGrade.id)
      .then((res) => { if (res.success && res.data) setSections(res.data) })
      .catch(() => {})
      .finally(() => setSectionsLoading(false))
  }, [selectedGrade])

  // ── Notify parent when any filter changes ──────────────────────────────────

  const notify = useCallback(
    (overrides: Partial<FilterState> = {}) => {
      onFilterChange({
        search: debouncedSearch || undefined,
        gradeId: selectedGrade?.id || undefined,
        gradeName: selectedGrade?.name || undefined,
        sectionId: selectedSectionId || undefined,
        role: selectedRole || undefined,
        ...overrides,
      })
    },
    [debouncedSearch, selectedGrade, selectedSectionId, selectedRole, onFilterChange]
  )

  // Notify on debounced search change
  useEffect(() => { notify() }, [debouncedSearch]) // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGradeChange = (gradeId: string) => {
    const grade = gradeId === '__all__' ? null : (gradeLevels.find((g) => g.id === gradeId) ?? null)
    setSelectedGrade(grade)
    setSelectedSectionId('')
    notify({
      gradeId: grade?.id,
      gradeName: grade?.name,
      sectionId: undefined,
    })
  }

  const handleSectionChange = (sectionId: string) => {
    const id = sectionId === '__all__' ? '' : sectionId
    setSelectedSectionId(id)
    notify({ sectionId: id || undefined })
  }

  const handleRoleChange = (role: string) => {
    const r = role === '__all__' ? '' : role
    setSelectedRole(r)
    notify({ role: r || undefined })
  }

  const handleClear = () => {
    setSearch('')
    setSelectedGrade(null)
    setSelectedSectionId('')
    setSelectedRole('')
    setSections([])
    onFilterChange({})
  }

  // ── Active filter count ────────────────────────────────────────────────────

  const activeCount = [
    debouncedSearch,
    selectedGrade,
    selectedSectionId,
    selectedRole,
  ].filter(Boolean).length

  const hasActive = activeCount > 0

  // ── Resolve search placeholder ─────────────────────────────────────────────

  const searchPlaceholder =
    entityType === 'students' ? t('searchStudents')
    : entityType === 'staff' || entityType === 'teachers' ? t('searchStaff')
    : t('search')

  // ── Filter bar content ─────────────────────────────────────────────────────

  const filterBarContent = (
    <div className="flex flex-wrap items-center gap-3">

      {/* Search */}
      {availableFilters.includes('search') && (
        <div className="relative flex-1 min-w-48">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); notify({ search: undefined }) }}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Grade */}
      {availableFilters.includes('grade') && (
        <Select
          value={selectedGrade?.id ?? '__all__'}
          onValueChange={handleGradeChange}
          disabled={gradesLoading}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('allGrades')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('allGrades')}</SelectItem>
            {gradeLevels.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Section — only when grade selected */}
      {availableFilters.includes('section') && selectedGrade && (
        <Select
          value={selectedSectionId || '__all__'}
          onValueChange={handleSectionChange}
          disabled={sectionsLoading}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('allSections')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('allSections')}</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Role */}
      {availableFilters.includes('role') && (
        <Select value={selectedRole || '__all__'} onValueChange={handleRoleChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('allRoles')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('allRoles')}</SelectItem>
            {STAFF_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t(`roles.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Active count badge + clear */}
      {hasActive && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            {t('filtersActive', { count: activeCount })}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 me-1" />
            {t('clearFilters')}
          </Button>
        </div>
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      {/* Mobile toggle */}
      <div className="flex items-center justify-between md:hidden mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {mobileOpen ? t('hideFilters') : t('showFilters')}
          {hasActive && (
            <Badge variant="default" className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Desktop: always visible */}
      <div className="hidden md:flex">{filterBarContent}</div>

      {/* Mobile: collapsible */}
      {mobileOpen && <div className="md:hidden">{filterBarContent}</div>}
    </div>
  )
}
