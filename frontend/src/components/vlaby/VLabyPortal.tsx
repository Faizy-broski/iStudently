'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  FlaskConical, LogIn, LogOut, Search, Loader2, ChevronRight,
  SlidersHorizontal, ChevronLeft, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  vlabyLogin,
  getVLabyCatalog,
  getMyVLabyExperiments,
  getVLabyCountries,
  getVLabyLevels,
  getVLabyClasses,
  getVLabySemesters,
  getVLabySubjects,
  getStoredVLabyToken,
  setStoredVLabyToken,
  clearVLabyToken,
  type VLabyExperiment,
  type VLabyPaginatedResult,
  type VLabyCatalogFilters,
  type VLabyRelationItem,
} from '@/lib/api/vlaby'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'catalog' | 'mine'

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

// ─── Login dialog ─────────────────────────────────────────────────────────────

function LoginDialog({ onSuccess, onCancel }: { onSuccess: (token: string) => void; onCancel: () => void }) {
  const t = useTranslations('vlaby.login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await vlabyLogin(email, password)
    setLoading(false)
    if (!res.success || !res.data?.token) {
      toast.error(res.error || 'VLaby login failed')
      return
    }
    setStoredVLabyToken(res.data.token)
    onSuccess(res.data.token)
    toast.success('Logged in to VLaby')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <FlaskConical size={18} className="text-indigo-600" />
            {t('title')}
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-500">{t('description')}</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{t('email')}</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{t('password')}</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            {t('sign_in')}
          </Button>
        </form>
        <p className="text-xs text-center text-gray-400">
          {t('no_account')}{' '}
          <a href="https://vlaby.com/en/register" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            {t('register')}
          </a>
        </p>
      </div>
    </div>
  )
}

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
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <Select value={value || '_all'} onValueChange={v => onSelect(v === '_all' ? '' : v)} disabled={l}>
        <SelectTrigger className="h-8 text-sm">
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
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <SlidersHorizontal size={12} /> {t('title')}
        </span>
        {hasFilters && (
          <button onClick={onReset} className="text-xs text-indigo-600 hover:underline">{t('reset')}</button>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">{t('search')}</label>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            placeholder={t('search_placeholder')}
            className="pl-8 h-8 text-sm"
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
  experiments, basePath, token, onLoginRequired, onLogout,
  page, lastPage, onPageChange, total,
}: {
  experiments: VLabyExperiment[]
  basePath: string
  token: string | null
  onLoginRequired: (pendingId: number) => void
  onLogout: () => void
  page: number
  lastPage: number
  onPageChange: (p: number) => void
  total: number
}) {
  const router = useRouter()
  const t = useTranslations('vlaby.table')

  const handleClick = (exp: VLabyExperiment) => {
    if (!token) {
      onLoginRequired(exp.id)
    } else {
      router.push(`${basePath}/${exp.id}`)
    }
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-w-0">
      {/* Results count + logout */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{total === 1 ? t('experiment_found') : t('experiments_found', { count: total })}</span>
        {token && (
          <Button variant="ghost" size="sm" className="gap-1 text-gray-400 h-7 text-xs" onClick={onLogout}>
            <LogOut size={12} /> {t('logout')}
          </Button>
        )}
        {!token && (
          <button
            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            onClick={() => onLoginRequired(0)}
          >
            <LogIn size={12} /> {t('sign_in_prompt')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">{t('col_title')}</th>
              <th className="px-4 py-3 text-left">{t('col_subject')}</th>
              <th className="px-4 py-3 text-left">{t('col_points')}</th>
              <th className="px-4 py-3 text-left">{t('col_country')}</th>
              <th className="px-4 py-3 text-left">{t('col_grade_term')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {experiments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">{t('no_results')}</td>
              </tr>
            ) : (
              experiments.map(exp => (
                <tr
                  key={exp.id}
                  className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                  onClick={() => handleClick(exp)}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                      {exp.title}
                      <ChevronRight size={13} className="text-indigo-400 flex-shrink-0" />
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
                  <td className="px-4 py-3 text-gray-600">{exp.country_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
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
            <ChevronLeft size={14} />
          </Button>
          <span className="text-sm text-gray-600">{t('page_of', { page, lastPage })}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={14} />
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
  const router = useRouter()
  const t = useTranslations('vlaby')

  const [token, setToken] = useState<string | null>(null)
  const [tokenChecked, setTokenChecked] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const [experiments, setExperiments] = useState<VLabyExperiment[]>([])
  const [pagination, setPagination] = useState<Pick<VLabyPaginatedResult, 'current_page' | 'last_page' | 'total'>>({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(false)

  // Login dialog state
  const [showLogin, setShowLogin] = useState(false)
  const pendingExpId = useRef<number>(0)

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialise token from localStorage
  useEffect(() => {
    const stored = getStoredVLabyToken()
    setToken(stored)
    setTokenChecked(true)
  }, [])

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
    const res = await getVLabyCatalog(apiFilters)
    setLoading(false)
    if (!res.success || !res.data) { toast.error(res.error || 'Failed to load experiments'); return }

    const result = res.data as VLabyPaginatedResult
    setExperiments(result.data ?? [])
    setPagination({ current_page: result.current_page ?? 1, last_page: result.last_page ?? 1, total: result.total ?? 0 })
  }, [])

  // Load my experiments
  const loadMine = useCallback(async () => {
    if (!token) { setShowLogin(true); return }
    setLoading(true)
    const res = await getMyVLabyExperiments()
    setLoading(false)
    if (!res.success) {
      if (res.code === 'VLABY_TOKEN_EXPIRED') { clearVLabyToken(); setToken(null); toast.error('VLaby session expired'); return }
      toast.error(res.error || 'Failed to load your experiments')
      return
    }
    const list = res.data?.experiments ?? []
    setExperiments(list)
    setPagination({ current_page: 1, last_page: 1, total: list.length })
  }, [token])

  // On filter / page / mode change
  useEffect(() => {
    if (!tokenChecked) return
    if (viewMode === 'catalog') {
      loadCatalog(filters, page)
    } else {
      loadMine()
    }
  }, [tokenChecked, viewMode, page, loadCatalog, loadMine]) // filters handled separately via debounce

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
    if (viewMode === 'catalog') applyFiltersDebounced(next)
  }

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
    loadCatalog(EMPTY_FILTERS, 1)
  }

  const handleLoginRequired = (expId: number) => {
    pendingExpId.current = expId
    setShowLogin(true)
  }

  const handleLoginSuccess = (tok: string) => {
    setToken(tok)
    setShowLogin(false)
    if (pendingExpId.current) {
      router.push(`${basePath}/${pendingExpId.current}`)
      pendingExpId.current = 0
    }
  }

  const handleLogout = () => {
    clearVLabyToken()
    setToken(null)
    toast.success('Logged out of VLaby')
    if (viewMode === 'mine') { setViewMode('catalog'); loadCatalog(filters, page) }
  }

  if (!tokenChecked) return null

  return (
    <>
      {showLogin && (
        <LoginDialog
          onSuccess={handleLoginSuccess}
          onCancel={() => { setShowLogin(false); pendingExpId.current = 0 }}
        />
      )}

      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-semibold text-gray-800 text-lg">
            <FlaskConical size={22} className="text-indigo-600" />
            {t('title')}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {/* Mobile filter toggle — only in catalog mode */}
            {viewMode === 'catalog' && (
              <Button
                variant="outline"
                size="sm"
                className="md:hidden gap-1"
                onClick={() => setFiltersOpen(v => !v)}
              >
                <SlidersHorizontal size={14} />
                {t('filters_btn')}
              </Button>
            )}
            <Button
              variant={viewMode === 'catalog' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setViewMode('catalog'); setPage(1); loadCatalog(filters, 1) }}
            >
              {t('browse_all')}
            </Button>
            <Button
              variant={viewMode === 'mine' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('mine')}
            >
              {t('my_experiments')}
            </Button>
          </div>
        </div>

        {/* Body: filter sidebar + table */}
        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Filter panel — catalog mode only */}
          {viewMode === 'catalog' && (
            <div className={`w-full md:w-56 shrink-0 border rounded-xl p-4 bg-gray-50/60 ${filtersOpen ? 'block' : 'hidden md:block'}`}>
              <FilterPanel
                filters={filters}
                onChange={handleFilterChange}
                onReset={handleResetFilters}
              />
            </div>
          )}

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
                token={token}
                onLoginRequired={handleLoginRequired}
                onLogout={handleLogout}
                page={pagination.current_page}
                lastPage={pagination.last_page}
                total={pagination.total}
                onPageChange={p => { setPage(p); if (viewMode === 'catalog') loadCatalog(filters, p) }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
