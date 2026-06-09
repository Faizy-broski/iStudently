'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search, X, SlidersHorizontal, ChevronDown, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useGradeLevels } from '@/hooks/useAcademics'
import { getSections } from '@/lib/api/academics'
import type { Section, GradeLevel } from '@/lib/api/academics'
import { useCampus } from '@/context/CampusContext'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterState {
  search?: string
  // Multi-select grades
  gradeIds?: string[]
  gradeNames?: string[]
  // Single-grade kept for backward compat (section cascade uses first selected grade)
  gradeId?: string
  gradeName?: string
  sectionId?: string
  role?: string
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

// ── Multi-select Grade Picker ─────────────────────────────────────────────────

function GradeMultiSelect({
  grades,
  selectedIds,
  loading,
  onChange,
  placeholder,
}: {
  grades: GradeLevel[]
  selectedIds: string[]
  loading: boolean
  onChange: (ids: string[]) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  const label =
    selectedIds.length === 0
      ? placeholder
      : selectedIds.length === 1
        ? grades.find((g) => g.id === selectedIds[0])?.name ?? placeholder
        : selectedIds.length === grades.length
          ? placeholder // all selected = same as none
          : `${selectedIds.length} grades`

  const isAllSelected = selectedIds.length === grades.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className={cn(
            'flex h-9 w-44 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            selectedIds.length > 0 && 'border-primary/60 bg-primary/5 text-primary'
          )}
        >
          <span className="truncate">{loading ? 'Loading…' : label}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        {/* Clear / All option */}
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
            selectedIds.length === 0 && 'font-medium text-primary'
          )}
        >
          <Check className={cn('h-4 w-4', selectedIds.length === 0 ? 'opacity-100 text-primary' : 'opacity-0')} />
          {placeholder}
        </button>

        <div className="my-1 border-t" />

        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {grades.map((g) => {
            const checked = selectedIds.includes(g.id)
            return (
              <label
                key={g.id}
                className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent select-none"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(g.id)}
                  className="shrink-0"
                />
                <span className="truncate">{g.name}</span>
              </label>
            )
          })}
        </div>

        {selectedIds.length > 0 && (
          <>
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear selection
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
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

  const [search, setSearch] = useState(currentFilters?.search ?? '')
  // Multi-select grade IDs
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>(currentFilters?.gradeIds ?? [])
  const [selectedSectionId, setSelectedSectionId] = useState(currentFilters?.sectionId ?? '')
  const [selectedRole, setSelectedRole] = useState(currentFilters?.role ?? '')
  const [sections, setSections] = useState<Section[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 500)
  const { gradeLevels, isLoading: gradesLoading } = useGradeLevels()
  const campusContext = useCampus()

  // Section cascade: only load when exactly 1 grade selected
  const singleSelectedGrade = selectedGradeIds.length === 1
    ? gradeLevels.find((g) => g.id === selectedGradeIds[0]) ?? null
    : null

  useEffect(() => {
    if (!singleSelectedGrade) {
      setSections([])
      setSelectedSectionId('')
      return
    }
    setSectionsLoading(true)
    getSections(singleSelectedGrade.id, campusContext?.selectedCampus?.id)
      .then((res) => { if (res.success && res.data) setSections(res.data) })
      .catch(() => {})
      .finally(() => setSectionsLoading(false))
  }, [singleSelectedGrade?.id, campusContext?.selectedCampus?.id])

  // ── Notify parent ──────────────────────────────────────────────────────────

  const notify = useCallback(
    (overrides: Partial<FilterState> = {}) => {
      const gradeIds = overrides.gradeIds ?? selectedGradeIds
      const gradeNames = gradeIds
        .map((id) => gradeLevels.find((g) => g.id === id)?.name)
        .filter(Boolean) as string[]

      onFilterChange({
        search: debouncedSearch || undefined,
        gradeIds: gradeIds.length ? gradeIds : undefined,
        gradeNames: gradeNames.length ? gradeNames : undefined,
        // keep legacy single fields for backward compat
        gradeId: gradeIds[0] ?? undefined,
        gradeName: gradeNames[0] ?? undefined,
        sectionId: (overrides.sectionId ?? selectedSectionId) || undefined,
        role: (overrides.role ?? selectedRole) || undefined,
        ...overrides,
      })
    },
    [debouncedSearch, selectedGradeIds, selectedSectionId, selectedRole, gradeLevels, onFilterChange]
  )

  useEffect(() => { notify() }, [debouncedSearch]) // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGradeChange = (ids: string[]) => {
    setSelectedGradeIds(ids)
    // Clear section whenever grade selection changes
    setSelectedSectionId('')

    const gradeNames = ids
      .map((id) => gradeLevels.find((g) => g.id === id)?.name)
      .filter(Boolean) as string[]

    onFilterChange({
      search: debouncedSearch || undefined,
      gradeIds: ids.length ? ids : undefined,
      gradeNames: gradeNames.length ? gradeNames : undefined,
      gradeId: ids[0] ?? undefined,
      gradeName: gradeNames[0] ?? undefined,
      sectionId: undefined,
      role: selectedRole || undefined,
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
    setSelectedGradeIds([])
    setSelectedSectionId('')
    setSelectedRole('')
    setSections([])
    onFilterChange({})
  }

  // ── Active filter count ────────────────────────────────────────────────────

  const activeCount = [
    debouncedSearch,
    selectedGradeIds.length > 0 ? true : null,
    selectedSectionId,
    selectedRole,
  ].filter(Boolean).length

  const hasActive = activeCount > 0

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

      {/* Grade — multi-select */}
      {availableFilters.includes('grade') && (
        <GradeMultiSelect
          grades={gradeLevels}
          selectedIds={selectedGradeIds}
          loading={gradesLoading}
          onChange={handleGradeChange}
          placeholder={t('allGrades')}
        />
      )}

      {/* Section — only when exactly 1 grade selected */}
      {availableFilters.includes('section') && singleSelectedGrade && (
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
