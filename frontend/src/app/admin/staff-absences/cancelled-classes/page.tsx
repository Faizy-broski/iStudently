'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as api from '@/lib/api/staff-absences'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { BookX, Filter } from 'lucide-react'

function formatDate(dt: string) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function CancelledClassesPage() {
  const t = useTranslations('staffAbsences')
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const [startDate, setStartDate] = useState(monthStart)
  const [endDate, setEndDate] = useState(today)

  const { data, isLoading, mutate } = useSWR(
    schoolId ? ['cancelled-classes', schoolId, campusId, startDate, endDate] : null,
    () =>
      api.getCancelledClasses({
        school_id: schoolId,
        campus_id: campusId,
        start_date: startDate,
        end_date: endDate,
      })
  )

  const rows = data?.data || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <BookX className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">{t('cancelledClasses.title')}</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('filters.from')}</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('filters.to')}</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
            <Button variant="outline" onClick={() => mutate()}>
              <Filter className="h-4 w-4 mr-2" />
              {t('refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('cancelledClasses.table.staffMember')}</TableHead>
                <TableHead>{t('cancelledClasses.table.coursePeriod')}</TableHead>
                <TableHead>{t('cancelledClasses.table.shortName')}</TableHead>
                <TableHead>{t('cancelledClasses.table.absenceStart')}</TableHead>
                <TableHead>{t('cancelledClasses.table.absenceEnd')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                        {t('empty.cancelledClasses')}
                      </TableCell>
                    </TableRow>
                  )
                : rows.map((row) => (
                    <TableRow key={`${row.absence_id}-${row.course_period_id}`}>
                      <TableCell className="font-medium">{row.staff_name}</TableCell>
                      <TableCell>{row.course_period_title}</TableCell>
                      <TableCell className="font-mono text-sm">{row.short_name}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.start_date)}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.end_date)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {t('cancelledClasses.resultsCount', { count: rows.length })}
      </p>
    </div>
  )
}
