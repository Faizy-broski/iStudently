'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, Loader2, Info } from 'lucide-react'
import { useCampus } from '@/context/CampusContext'
import { getGradeLevels, getSections, type GradeLevel, type Section } from '@/lib/api/academics'
import { downloadMonthlySheetExcel, getMonthlySheetData, type MonthlySheetParams } from '@/lib/api/attendance'
import { exportMonthlySheetPdf } from '@/lib/utils/monthlySheetPdf'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Scope = 'section' | 'grade' | 'staff'

export default function MonthlyAttendanceSheetPage() {
  const t = useTranslations('attendanceMonthlySheet')
  const uiLocale = useLocale() === 'ar' ? 'ar' : 'en'
  const campusId = useCampus()?.selectedCampus?.id

  const now = new Date()
  const [scope, setScope] = useState<Scope>('section')
  const [gradeId, setGradeId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [department, setDepartment] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [mode, setMode] = useState<'blank' | 'filled'>('blank')
  const [sheetLocale, setSheetLocale] = useState<'en' | 'ar'>(uiLocale)
  const [supervisor, setSupervisor] = useState('')
  const [room, setRoom] = useState('')
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)

  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])

  useEffect(() => {
    setGradeId('')
    setSectionId('')
    getGradeLevels(campusId).then((r) => setGrades((r.data || []).filter((g) => g.is_active !== false)))
  }, [campusId])

  useEffect(() => {
    setSectionId('')
    setSections([])
    if (!gradeId) return
    getSections(gradeId, campusId).then((r) => setSections((r.data || []).filter((s) => s.is_active)))
  }, [gradeId, campusId])

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(uiLocale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { month: 'long' }).format(new Date(2000, i, 1))
  )
  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i)

  const ready =
    (scope === 'section' && !!sectionId) || (scope === 'grade' && !!gradeId) || scope === 'staff'

  const params = (): MonthlySheetParams => ({
    scope,
    sectionId: scope === 'section' ? sectionId : undefined,
    gradeId: scope === 'grade' ? gradeId : undefined,
    department: scope === 'staff' ? department.trim() || undefined : undefined,
    month,
    year,
    mode,
    locale: sheetLocale,
    campusId,
    supervisor: supervisor.trim() || undefined,
    room: room.trim() || undefined,
  })

  const baseName = `attendance-sheet-${year}-${String(month).padStart(2, '0')}-${mode}`

  const handleExcel = async () => {
    setBusy('excel')
    try {
      const blob = await downloadMonthlySheetExcel(params())
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e.message || t('exportFailed'))
    } finally {
      setBusy(null)
    }
  }

  const handlePdf = async () => {
    setBusy('pdf')
    try {
      const models = await getMonthlySheetData(params())
      await exportMonthlySheetPdf(models, baseName)
    } catch (e: any) {
      toast.error(e.message || t('exportFailed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('whoTitle')}</CardTitle>
          <CardDescription>{t('whoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('scope')}</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="section">{t('scopeSection')}</SelectItem>
                <SelectItem value="grade">{t('scopeGrade')}</SelectItem>
                <SelectItem value="staff">{t('scopeStaff')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope !== 'staff' && (
            <div className="space-y-1.5">
              <Label>{t('grade')}</Label>
              <Select value={gradeId} onValueChange={setGradeId}>
                <SelectTrigger><SelectValue placeholder={t('selectGrade')} /></SelectTrigger>
                <SelectContent>
                  {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === 'section' && (
            <div className="space-y-1.5">
              <Label>{t('section')}</Label>
              <Select value={sectionId} onValueChange={setSectionId} disabled={!gradeId}>
                <SelectTrigger><SelectValue placeholder={gradeId ? t('selectSection') : t('selectGradeFirst')} /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {gradeId && sections.length === 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-amber-700">{t('noSectionsHint')}</p>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setScope('grade')}>
                    {t('useWholeGrade')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {scope === 'grade' && <p className="text-xs text-muted-foreground self-end pb-2">{t('gradeHint')}</p>}

          {scope === 'staff' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('department')}</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder={t('departmentPlaceholder')} maxLength={120} />
              <p className="text-xs text-muted-foreground">{t('departmentHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('optionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('month')}</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('year')}</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('content')}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'blank' | 'filled')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">{t('modeBlank')}</SelectItem>
                <SelectItem value="filled">{t('modeFilled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('sheetLanguage')}</Label>
            <Select value={sheetLocale} onValueChange={(v) => setSheetLocale(v as 'en' | 'ar')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('supervisor')}</Label>
            <Input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder={t('autoFilled')} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('room')}</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder={t('autoFilled')} maxLength={60} />
          </div>

          {scope === 'staff' && mode === 'filled' && (
            <div className="sm:col-span-2 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{t('staffFilledNote')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleExcel} disabled={!ready || busy !== null} className="gap-2">
          {busy === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {t('downloadExcel')}
        </Button>
        <Button onClick={handlePdf} disabled={!ready || busy !== null} variant="outline" className="gap-2">
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {t('downloadPdf')}
        </Button>
      </div>
    </div>
  )
}
