'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Loader2, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  type MarkingPeriod,
  type MarkingPeriodType,
  type GroupedMarkingPeriods,
  MP_TYPE_LABELS,
  MP_TYPE_SHORT,
  getMarkingPeriodsGrouped,
} from '@/lib/api/marking-periods'

const MP_TYPES: MarkingPeriodType[] = ['FY', 'SEM', 'QTR', 'PRO']

function formatDate(date?: string | null): string {
  if (!date) return '—'
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function isCurrentByDate(mp: MarkingPeriod): boolean {
  if (!mp.start_date || !mp.end_date) return false
  const today = new Date().toISOString().split('T')[0]
  return mp.start_date <= today && mp.end_date >= today
}

export default function ParentMarkingPeriodsPage() {
  const { selectedStudentData, isLoading: studentsLoading } = useParentDashboard()

  const [grouped, setGrouped] = useState<GroupedMarkingPeriods>({
    FY: [], SEM: [], QTR: [], PRO: [],
  })
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const campusId = selectedStudentData?.campus_id

  const fetchData = useCallback(async () => {
    if (!campusId) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await getMarkingPeriodsGrouped(campusId)
      setGrouped(data)
    } catch {
      // silent — empty state shown
    } finally {
      setLoading(false)
    }
  }, [campusId])

  useEffect(() => {
    if (!studentsLoading) fetchData()
  }, [fetchData, studentsLoading])

  // Auto-select the current active quarter when data loads
  useEffect(() => {
    if (grouped.QTR.length > 0 && !selectedId) {
      const active = grouped.QTR.find(isCurrentByDate)
      if (active) setSelectedId(active.id)
    }
  }, [grouped, selectedId])

  const selectedMP = selectedId
    ? Object.values(grouped).flat().find(mp => mp.id === selectedId) ?? null
    : null

  function getFilteredItems(mpType: MarkingPeriodType): MarkingPeriod[] {
    const items = grouped[mpType]
    const parentTypes: Record<MarkingPeriodType, MarkingPeriodType | null> = {
      FY: null, SEM: 'FY', QTR: 'SEM', PRO: 'QTR',
    }
    const parentType = parentTypes[mpType]
    if (!parentType || !selectedMP) return items

    const selectedTypeIndex = MP_TYPES.indexOf(selectedMP.mp_type as MarkingPeriodType)
    const currentTypeIndex = MP_TYPES.indexOf(mpType)

    if (selectedMP.mp_type === parentType) return items.filter(mp => mp.parent_id === selectedMP.id)
    if (selectedMP.mp_type === mpType) return items.filter(mp => mp.parent_id === selectedMP.parent_id)
    if (selectedTypeIndex < currentTypeIndex) {
      let parentIds: string[] = [selectedMP.id]
      for (let i = selectedTypeIndex + 1; i < currentTypeIndex; i++) {
        const intermediateItems = grouped[MP_TYPES[i]].filter(mp => parentIds.includes(mp.parent_id || ''))
        parentIds = intermediateItems.map(mp => mp.id)
      }
      return items.filter(mp => parentIds.includes(mp.parent_id || ''))
    }
    return items
  }

  if (studentsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to view marking periods.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          Marking Periods
        </h1>
        <p className="text-muted-foreground">
          Academic calendar hierarchy &mdash;{' '}
          <span className="text-[#022172] dark:text-blue-400 font-medium">
            {selectedStudentData.campus_name}
          </span>
        </p>
      </div>

      {/* Detail panel for selected period */}
      {selectedMP && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border p-5 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#022172] dark:text-white">
              {MP_TYPE_LABELS[selectedMP.mp_type as MarkingPeriodType]}
            </span>
            <span className="text-sm font-medium">{selectedMP.title}</span>
            <span className="text-xs text-muted-foreground">({selectedMP.short_name})</span>
            {isCurrentByDate(selectedMP) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Current
              </span>
            )}
            {selectedMP.does_grades && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Graded</span>
            )}
            {selectedMP.does_comments && (
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Comments</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Starts</p>
              <p className="font-medium">{formatDate(selectedMP.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Ends</p>
              <p className="font-medium">{formatDate(selectedMP.end_date)}</p>
            </div>
            {selectedMP.does_grades && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Grade Posting Opens</p>
                  <p className="font-medium">{formatDate(selectedMP.post_start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Grade Posting Closes</p>
                  <p className="font-medium">{formatDate(selectedMP.post_end_date)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Four-column hierarchy grid (read-only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MP_TYPES.map(mpType => {
          const items = getFilteredItems(mpType)
          return (
            <div key={mpType} className="bg-white dark:bg-gray-900 rounded-lg border flex flex-col">
              <div className="px-3 py-2 border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                <h3 className="text-xs font-semibold text-[#022172] dark:text-white uppercase tracking-wider">
                  {MP_TYPE_SHORT[mpType]}
                </h3>
              </div>
              <div className="flex-1 divide-y max-h-72 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-gray-400">
                    No {MP_TYPE_SHORT[mpType].toLowerCase()} defined
                  </div>
                ) : (
                  items.map(mp => {
                    const isSelected = selectedId === mp.id
                    const isCurrent = isCurrentByDate(mp)
                    return (
                      <button
                        key={mp.id}
                        onClick={() => setSelectedId(isSelected ? null : mp.id)}
                        className={`w-full text-left px-3 py-2 transition-colors text-sm ${
                          isSelected
                            ? 'bg-[#022172]/10 dark:bg-[#022172]/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate ${isSelected ? 'font-bold text-[#022172] dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {mp.title}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isCurrent && <span className="w-2 h-2 rounded-full bg-green-500" title="Currently active" />}
                            {mp.does_grades && <span className="text-[10px] text-blue-500 font-medium" title="Graded">G</span>}
                          </div>
                        </div>
                        {(mp.start_date || mp.end_date) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(mp.start_date)} – {formatDate(mp.end_date)}
                          </p>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Currently active
        </span>
        <span className="flex items-center gap-1">
          <span className="text-blue-500 font-medium">G</span> Graded period
        </span>
        <span className="text-xs italic">Click any period to view details</span>
      </div>
    </div>
  )
}
