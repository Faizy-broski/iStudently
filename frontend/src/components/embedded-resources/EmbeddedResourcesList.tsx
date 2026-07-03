'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Globe, ExternalLink, Loader2, AlertTriangle, Search, X, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import * as embeddedApi from '@/lib/api/embedded-resources'

interface Props {
  role: 'teacher' | 'student' | 'parent'
  gradeId?: string
}

export default function EmbeddedResourcesList({ role, gradeId }: Props) {
  const [resources, setResources] = useState<embeddedApi.EmbeddedResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<string>('all')
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'title_asc' | 'title_desc' | 'newest' | 'oldest'>('title_asc')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await embeddedApi.getEmbeddedResourcesForUser(gradeId)
      if (res.success && res.data) {
        setResources(res.data)
      } else {
        setError(res.error || 'Failed to load resources')
      }
      setLoading(false)
    }
    load()
  }, [gradeId])

  // Derive unique grade options from enriched data
  const gradeOptions = useMemo(() => {
    const map = new Map<string, string>() // id → name
    for (const r of resources) {
      const ids = r.published_grade_ids || []
      const names = r.published_grade_names || []
      ids.forEach((id, i) => {
        if (!map.has(id)) map.set(id, names[i] || id)
      })
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [resources])

  // Derive unique teacher options from enriched creator_name
  const teacherOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of resources) {
      if (r.creator_name) set.add(r.creator_name)
    }
    return Array.from(set).sort()
  }, [resources])

  // Apply client-side filters
  const filtered = useMemo(() => {
    let list = resources

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.title.toLowerCase().includes(q))
    }

    if (selectedGrade !== 'all') {
      list = list.filter(r =>
        // If resource has no grade restriction it's visible to all
        !r.published_grade_ids ||
        r.published_grade_ids.length === 0 ||
        r.published_grade_ids.includes(selectedGrade)
      )
    }

    if (selectedTeacher !== 'all') {
      list = list.filter(r => r.creator_name === selectedTeacher)
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'title_asc': return a.title.localeCompare(b.title)
        case 'title_desc': return b.title.localeCompare(a.title)
        case 'newest': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        case 'oldest': return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        default: return 0
      }
    })

    return list
  }, [resources, search, selectedGrade, selectedTeacher, sortBy])

  const hasActiveFilters = search.trim() !== '' || selectedGrade !== 'all' || selectedTeacher !== 'all'

  const clearFilters = () => {
    setSearch('')
    setSelectedGrade('all')
    setSelectedTeacher('all')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
        <AlertTriangle className="h-8 w-8 text-yellow-500" />
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Globe className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Embedded Resources</h1>
          <p className="text-sm text-gray-500">External websites and tools from your school</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resources by title..."
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Grade filter — only shown if there are multiple grade options */}
          {gradeOptions.length > 0 && (
            <div className="relative min-w-40">
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
                className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Grades</option>
                {gradeOptions.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Teacher/creator filter — only shown if resources have creator names */}
          {teacherOptions.length > 0 && (
            <div className="relative min-w-45">
              <select
                value={selectedTeacher}
                onChange={e => setSelectedTeacher(e.target.value)}
                className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Teachers</option>
                {teacherOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Sort filter */}
          <div className="relative min-w-40">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full h-9 appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="title_asc">Title (A-Z)</option>
              <option value="title_desc">Title (Z-A)</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Active filter summary */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {resources.length} resource{resources.length !== 1 ? 's' : ''}
            {selectedGrade !== 'all' && (
              <> · Grade: <span className="font-medium">{gradeOptions.find(g => g.id === selectedGrade)?.name}</span></>
            )}
            {selectedTeacher !== 'all' && (
              <> · Teacher: <span className="font-medium">{selectedTeacher}</span></>
            )}
          </p>
        )}
      </div>

      {/* Resource grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {hasActiveFilters ? 'No resources match your filters' : 'No embedded resources available'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/${role}/resources/embedded/${r.id}`}
              className="group flex items-start gap-3 p-4 bg-white rounded-xl border shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="p-2.5 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors shrink-0 mt-0.5">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800 truncate group-hover:text-blue-700 transition-colors">
                  {r.title}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{r.url}</p>
                {/* Grade tags */}
                {r.published_grade_names && r.published_grade_names.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.published_grade_names.slice(0, 3).map(name => (
                      <span
                        key={name}
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100"
                      >
                        {name}
                      </span>
                    ))}
                    {r.published_grade_names.length > 3 && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                        +{r.published_grade_names.length - 3}
                      </span>
                    )}
                  </div>
                )}
                {/* Creator */}
                {r.creator_name && (
                  <p className="text-[10px] text-gray-400 mt-1.5">By {r.creator_name}</p>
                )}
              </div>
              <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-blue-500 shrink-0 transition-colors mt-1" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
