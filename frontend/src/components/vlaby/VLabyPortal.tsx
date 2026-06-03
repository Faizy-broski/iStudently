'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  FlaskConical, Search, Loader2, ChevronRight,
  SlidersHorizontal, ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getVLabyCatalog,
  getVLabyCountries,
  getVLabyLevels,
  getVLabyClasses,
  getVLabySemesters,
  getVLabySubjects,
  type VLabyExperiment,
  type VLabyPaginatedResult,
  type VLabyCatalogFilters,
  type VLabyRelationItem,
} from '@/lib/api/vlaby'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterState {
  country_id: string
  level_id: string
  level_class_id: string
  semester_id: string
  subject_id: string
  search: string
}

const EMPTY_FILTERS: FilterState = {
  country_id: '', level_id: '', level_class_id: '', semester_id: '', subject_id: '', search: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, string> = {
  Physics: 'bg-blue-100 text-blue-800',
  Chemistry: 'bg-purple-100 text-purple-800',
  Biology: 'bg-green-100 text-green-800',
  biology: 'bg-green-100 text-green-800',
}
const subjectColor = (s: string) => SUBJECT_COLORS[s] ?? 'bg-gray-100 text-gray-700'

// ─── Filter panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: FilterState
  onChange: (next: Partial<FilterState>) => void
  onReset: () => void
}

/**
 * VLaby wraps relation arrays in various shapes:
 *  - direct array: [...]
 *  - named key: { levels: [...] }
 *  - paginator under key: { levels: { data: [...], total, ... } }
 * Walk one level deep and return the first array found.
 */
function extractArray(data: unknown): VLabyRelationItem[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    for (const val of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(val)) return val as VLabyRelationItem[]
      // paginator-style nested object: { key: { data: [...] } }
      if (val && typeof val === 'object' && Array.isArray((val as any).data)) {
        return (val as any).data as VLabyRelationItem[]
      }
    }
  }
  return []
}

function FilterPanel({ filters, onChange, onReset }: FilterPanelProps) {
  const t = useTranslations('vlaby.filters')
  const [countries, setCountries] = useState<VLabyRelationItem[]>([])
  const [levels, setLevels] = useState<VLabyRelationItem[]>([])
  const [classes, setClasses] = useState<VLabyRelationItem[]>([])
  const [semesters, setSemesters] = useState<VLabyRelationItem[]>([])
  const [subjects, setSubjects] = useState<VLabyRelationItem[]>([])

  const [loadingC, setLoadingC] = useState(false)
  const [loadingL, setLoadingL] = useState(false)
  const [loadingCl, setLoadingCl] = useState(false)
  const [loadingSem, setLoadingSem] = useState(false)
  const [loadingSub, setLoadingSub] = useState(false)

  // Load countries once
  useEffect(() => {
    setLoadingC(true)
    getVLabyCountries().then(r => {
      setCountries(r.success ? extractArray(r.data) : [])
      setLoadingC(false)
    })
  }, [])

  // Cascade: country → levels
  useEffect(() => {
    if (!filters.country_id) { setLevels([]); return }
    setLoadingL(true)
    getVLabyLevels(filters.country_id).then(r => {
      setLevels(r.success ? extractArray(r.data) : [])
      setLoadingL(false)
    })
  }, [filters.country_id])

  // level → classes
  useEffect(() => {
    if (!filters.level_id) { setClasses([]); return }
    setLoadingCl(true)
    getVLabyClasses(filters.level_id).then(r => {
      setClasses(r.success ? extractArray(r.data) : [])
      setLoadingCl(false)
    })
  }, [filters.level_id])

  // class → semesters
  useEffect(() => {
    if (!filters.level_class_id) { setSemesters([]); return }
    setLoadingSem(true)
    getVLabySemesters(filters.level_class_id).then(r => {
      setSemesters(r.success ? extractArray(r.data) : [])
      setLoadingSem(false)
    })
  }, [filters.level_class_id])

  // semester → subjects
  useEffect(() => {
    if (!filters.semester_id) { setSubjects([]); return }
    setLoadingSub(true)
    getVLabySubjects(filters.semester_id).then(r => {
      setSubjects(r.success ? extractArray(r.data) : [])
      setLoadingSub(false)
    })
  }, [filters.semester_id])

  const SelectRow = ({ label, value, items, loading: l, placeholder, onSelect }: {
    label: string; value: string; items: VLabyRelationItem[]; loading: boolean
    placeholder: string; onSelect: (v: string) => void
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <Select value={value || '_all'} onValueChange={v => onSelect(v === '_all' ? '' : v)} disabled={l}>
        <SelectTrigger className="h-8 text-sm dark:bg-gray-800 dark:border-gray-700">
          <SelectValue placeholder={l ? t('search_placeholder') : placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-60 overflow-y-auto">
          <SelectItem value="_all">{t('all')}</SelectItem>
          {Array.isArray(items) && items.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.locale_name ?? i.name ?? String(i.id)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  const hasFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="flex flex-col gap-3 min-w-[200px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <SlidersHorizontal size={12} /> {t('title')}
        </span>
        {hasFilters && (
          <button onClick={onReset} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">{t('reset')}</button>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('search')}</label>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            placeholder={t('search_placeholder')}
            className="pl-8 h-8 text-sm dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-500"
          />
        </div>
      </div>

      <SelectRow
        label={t('country')} value={filters.country_id} items={countries}
        loading={loadingC} placeholder={t('all_countries')}
        onSelect={v => onChange({ country_id: v, level_id: '', level_class_id: '', semester_id: '', subject_id: '' })}
      />
      <SelectRow
        label={t('level')} value={filters.level_id} items={levels}
        loading={loadingL} placeholder={filters.country_id ? t('all_levels') : t('select_country_first')}
        onSelect={v => onChange({ level_id: v, level_class_id: '', semester_id: '', subject_id: '' })}
      />
      <SelectRow
        label={t('class')} value={filters.level_class_id} items={classes}
        loading={loadingCl} placeholder={filters.level_id ? t('all_classes') : t('select_level_first')}
        onSelect={v => onChange({ level_class_id: v, semester_id: '', subject_id: '' })}
      />
      <SelectRow
        label={t('semester')} value={filters.semester_id} items={semesters}
        loading={loadingSem} placeholder={filters.level_class_id ? t('all_semesters') : t('select_class_first')}
        onSelect={v => onChange({ semester_id: v, subject_id: '' })}
      />
      <SelectRow
        label={t('subject')} value={filters.subject_id} items={subjects}
        loading={loadingSub} placeholder={filters.semester_id ? t('all_subjects') : t('select_semester_first')}
        onSelect={v => onChange({ subject_id: v })}
      />
    </div>
  )
}

// ─── Experiments table ────────────────────────────────────────────────────────

function ExperimentsTable({
  experiments, basePath,
  page, lastPage, onPageChange, total,
}: {
  experiments: VLabyExperiment[]
  basePath: string
  page: number
  lastPage: number
  onPageChange: (p: number) => void
  total: number
}) {
  const router = useRouter()
  const t = useTranslations('vlaby.table')

  const handleClick = (exp: VLabyExperiment) => {
    router.push(`${basePath}/${exp.id}`)
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-w-0">
      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{total === 1 ? t('experiment_found') : t('experiments_found', { count: total })}</span>
      </div>

      {/* Table */}
      <div className="border dark:border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">{t('col_title')}</th>
              <th className="px-4 py-3 text-left">{t('col_subject')}</th>
              <th className="px-4 py-3 text-left">{t('col_points')}</th>
              <th className="px-4 py-3 text-left">{t('col_country')}</th>
              <th className="px-4 py-3 text-left">{t('col_grade_term')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {experiments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">{t('no_results')}</td>
              </tr>
            ) : (
              experiments.map(exp => (
                <tr
                  key={exp.id}
                  className="hover:bg-indigo-50/40 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  onClick={() => handleClick(exp)}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                      {exp.title}
                      <ChevronRight size={13} className="text-indigo-400 dark:text-indigo-500 flex-shrink-0 rtl:rotate-180" />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${subjectColor(exp.subject_name)}`}>
                      {exp.subject_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {exp.points > 0 ? <Badge variant="secondary">{exp.points} {t('pts')}</Badge> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{exp.country_name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {exp.level_name} · {exp.level_class_name} · {exp.semester_name}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={14} className="rtl:rotate-180" />
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('page_of', { page, lastPage })}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={14} className="rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main portal ──────────────────────────────────────────────────────────────

interface VLabyPortalProps {
  basePath: string
}

export default function VLabyPortal({ basePath }: VLabyPortalProps) {
  const t = useTranslations('vlaby')
  const locale = useLocale()

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const [experiments, setExperiments] = useState<VLabyExperiment[]>([])
  const [pagination, setPagination] = useState<Pick<VLabyPaginatedResult, 'current_page' | 'last_page' | 'total'>>({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(false)

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load catalog
  const loadCatalog = useCallback(async (f: FilterState, p: number) => {
    setLoading(true)
    const apiFilters: VLabyCatalogFilters = {
      ...(f.country_id && { country_id: f.country_id }),
      ...(f.level_id && { level_id: f.level_id }),
      ...(f.level_class_id && { level_class_id: f.level_class_id }),
      ...(f.semester_id && { semester_id: f.semester_id }),
      ...(f.subject_id && { subject_id: f.subject_id }),
      ...(f.search && { search: f.search }),
      page: p,
      length_page: 25,
    }
    const res = await getVLabyCatalog(apiFilters, locale)
    setLoading(false)
    if (!res.success || !res.data) { toast.error(res.error || 'Failed to load experiments'); return }

    const result = res.data as VLabyPaginatedResult
    setExperiments(result.data ?? [])
    setPagination({ current_page: result.current_page ?? 1, last_page: result.last_page ?? 1, total: result.total ?? 0 })
  }, [locale])

  // On filter / page change
  useEffect(() => {
    loadCatalog(filters, page)
  }, [page, loadCatalog]) // filters handled separately via debounce

  const applyFiltersDebounced = useCallback((next: FilterState) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      loadCatalog(next, 1)
    }, 350)
  }, [loadCatalog])

  const handleFilterChange = (partial: Partial<FilterState>) => {
    const next = { ...filters, ...partial }
    setFilters(next)
    applyFiltersDebounced(next)
  }

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
    loadCatalog(EMPTY_FILTERS, 1)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100 text-lg">
          <FlaskConical size={22} className="text-indigo-600 dark:text-indigo-400" />
          {t('title')}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {/* Mobile filter toggle */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden gap-1 dark:border-gray-700 dark:text-gray-300"
            onClick={() => setFiltersOpen(v => !v)}
          >
            <SlidersHorizontal size={14} />
            {t('filters_btn')}
          </Button>
        </div>
      </div>

      {/* Body: filter sidebar + table */}
      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Filter panel */}
        <div className={`w-full md:w-56 shrink-0 border rounded-xl p-4 bg-gray-50/60 dark:bg-gray-900 dark:border-gray-800 ${filtersOpen ? 'block' : 'hidden md:block'}`}>
          <FilterPanel
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center min-h-[30vh] gap-2 text-gray-500">
              <Loader2 size={20} className="animate-spin" /> {t('loading')}
            </div>
          ) : (
            <ExperimentsTable
              experiments={experiments}
              basePath={basePath}
              page={pagination.current_page}
              lastPage={pagination.last_page}
              total={pagination.total}
              onPageChange={p => { setPage(p); loadCatalog(filters, p) }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
