'use client'

/** The one piece the original delivery explicitly left unbuilt — its data layer (listClassProgress / hadith_forty_class_summary) was ready with no UI. */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { getClassSummary, type ClassProgressRow } from '@/lib/api/hadith-forty'
import { useCampus } from '@/context/CampusContext'

export function ClassProgress() {
  const t = useTranslations('hadithForty')
  const campusId = useCampus()?.selectedCampus?.id
  const [rows, setRows] = useState<ClassProgressRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const token = await getAuthToken()
      if (!token) return
      const res = await getClassSummary(token, campusId)
      if (res.success && res.data) setRows(res.data)
      setLoading(false)
    })()
  }, [campusId])

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">{t('class.title')}</h1>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('class.colStudent')}</TableHead>
                  <TableHead>{t('class.colMastered')}</TableHead>
                  <TableHead>{t('class.colLearning')}</TableHead>
                  <TableHead>{t('class.colRepetitions')}</TableHead>
                  <TableHead>{t('class.colDueToday')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.profileId}>
                    <TableCell className="font-medium">{r.firstName} {r.lastName}</TableCell>
                    <TableCell>{r.mastered} / 42</TableCell>
                    <TableCell>{r.learning}</TableCell>
                    <TableCell>{r.totalRepetitions}</TableCell>
                    <TableCell>{r.dueToday > 0 ? <span className="text-primary font-semibold">{r.dueToday}</span> : r.dueToday}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('class.empty')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
