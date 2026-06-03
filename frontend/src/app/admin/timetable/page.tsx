"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Calendar, Loader2, RefreshCw, Settings, ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Download, FileText, ExternalLink, Pencil, RotateCcw } from "lucide-react"
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SectionTimetableCard, AssignSlotDialog, TimetableBuilder } from "@/components/timetable"
import Link from "next/link"
import * as timetableApi from "@/lib/api/timetable"
import * as teachersApi from "@/lib/api/teachers"
import * as academicsApi from "@/lib/api/academics"
import { TimetableEntry } from "@/lib/api/timetable"
import { useCampus } from "@/context/CampusContext"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import { formatTime, formatTimeRange } from "@/lib/utils/formatTime"
import { useTranslations } from "next-intl"

export default function TimetablePage() {
  const t = useTranslations('school.timetable')
  const daysT = useTranslations('school.timetable.days')
  
  // Campus context
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  
  // Don't render until campus context is available
  if (!campusContext) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Campus-specific data using hooks
  const { gradeLevels, loading: gradeLevelsLoading } = useGradeLevels()
  const { sections, loading: sectionsLoading } = useSections()
  
  // Other data state - using GlobalPeriod from the /periods endpoint
  const [periods, setPeriods] = useState<teachersApi.GlobalPeriod[]>([])
  const [academicYears, setAcademicYears] = useState<teachersApi.AcademicYear[]>([])
  const [assignments, setAssignments] = useState<teachersApi.TeacherSubjectAssignment[]>([])

  // Timetable entries per section
  const [sectionEntries, setSectionEntries] = useState<Record<string, TimetableEntry[]>>({})

  // UI state
  const [loading, setLoading] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("")
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical')

  // Combined loading state
  const dataLoading = gradeLevelsLoading || sectionsLoading || loading

  // Refs for PDF capture
  const gridTimetableRef = useRef<HTMLDivElement>(null)
  const singleTimetableRef = useRef<HTMLDivElement>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{
    sectionId: string;
    sectionName: string;
    day: string;
    period: teachersApi.Period;
    existingEntry?: TimetableEntry;
  } | null>(null)

  // Filtered sections based on selected grade and campus
  const filteredSections = useMemo(() => {
    if (!selectedGrade || !selectedCampus) return []
    return sections.filter(s => 
      s.grade_level_id === selectedGrade && 
      s.is_active &&
      (s.campus_id === selectedCampus.id || s.school_id === selectedCampus.id)
    )
  }, [selectedGrade, selectedCampus, sections])

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  // Reload periods when campus changes
  useEffect(() => {
    if (selectedCampus) {
      loadPeriods()
    }
  }, [selectedCampus])

  // Load timetable when grade/year changes
  useEffect(() => {
    if (selectedGrade && selectedAcademicYear && filteredSections.length > 0) {
      loadAllSectionTimetables()
    }
  }, [selectedGrade, selectedAcademicYear, filteredSections.length])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [periodsRes, yearsRes, assignmentsRes] = await Promise.all([
        teachersApi.getGlobalPeriods(selectedCampus?.id),
        teachersApi.getAcademicYears(),
        teachersApi.getTeacherAssignments()
      ])

      setPeriods(periodsRes) // Already sorted by sort_order
      setAcademicYears(yearsRes)
      setAssignments(assignmentsRes)

      // Auto-select current academic year
      const currentYear = yearsRes.find(y => y.is_current)
      if (currentYear) {
        setSelectedAcademicYear(currentYear.id)
      }
    } catch (error: any) {
      toast.error(error.message || t('err_load_data'))
    } finally {
      setLoading(false)
    }
  }

  const loadPeriods = async () => {
    try {
      const periodsRes = await teachersApi.getGlobalPeriods(selectedCampus?.id)
      setPeriods(periodsRes) // Already sorted by sort_order
    } catch (error: any) {
      toast.error(error.message || t('err_load_periods'))
    }
  }

  const loadAllSectionTimetables = async () => {
    if (!selectedAcademicYear || filteredSections.length === 0) return

    setLoadingEntries(true)
    try {
      // Load all section timetables in parallel
      const entriesPromises = filteredSections.map(section =>
        timetableApi.getTimetableBySection(section.id, selectedAcademicYear)
          .then(entries => ({ sectionId: section.id, entries }))
          .catch(() => ({ sectionId: section.id, entries: [] }))
      )

      const results = await Promise.all(entriesPromises)

      const newEntries: Record<string, TimetableEntry[]> = {}
      results.forEach(({ sectionId, entries }) => {
        newEntries[sectionId] = entries
      })

      setSectionEntries(newEntries)
    } catch (error: any) {
      toast.error(t('err_load_timetables'))
    } finally {
      setLoadingEntries(false)
    }
  }

  const handleSlotClick = useCallback((sectionId: string, day: string, period: teachersApi.Period) => {
    if (period.is_break) {
      toast.info(t('err_break_assignment'))
      return
    }

    const section = sections.find(s => s.id === sectionId)
    const entries = sectionEntries[sectionId] || []
    const existingEntry = entries.find(
      e => e.day_of_week === getDayNumber(day) && e.period_id === period.id
    )

    setSelectedSlot({
      sectionId,
      sectionName: section?.name || '',
      day,
      period,
      existingEntry
    })
    setDialogOpen(true)
  }, [sections, sectionEntries, t])

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm(t('confirm_remove'))) return

    try {
      await timetableApi.deleteTimetableEntry(entryId)
      toast.success(t('success_removed'))
      loadAllSectionTimetables()
    } catch (error: any) {
      toast.error(error.message || t('err_delete'))
    }
  }

  const getDayNumber = (day: string): number => {
    const map: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }
    return map[day] || 0
  }

  const selectedGradeName = gradeLevels.find(g => g.id === selectedGrade)?.name

  const handleDownloadCSV = () => {
    if (!selectedGrade || filteredSections.length === 0) {
      toast.error(t('err_select_grade_first'))
      return
    }

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const localizedDays = DAYS.map(d => daysT(d))
    // Sort by sort_order (global periods)
    const sortedPeriods = [...periods].sort((a, b) => a.sort_order - b.sort_order)

    let csvContent = 'data:text/csv;charset=utf-8,'

    // Header: Section info
    csvContent += `${t('csv_title', { grade: selectedGradeName })}\n`
    csvContent += `${t('filter_year')}: ${academicYears.find(y => y.id === selectedAcademicYear)?.name}\n\n`

    filteredSections.forEach(section => {
      const entries = sectionEntries[section.id] || []

      csvContent += `\nSection: ${section.name}\n`
      csvContent += `${t('csv_period')},${t('csv_time')},` + localizedDays.join(',') + '\n'

      sortedPeriods.forEach(period => {
        const periodName = period.title || period.short_name || `P${period.sort_order}`
        const periodTime = formatTimeRange(period.start_time, period.end_time) || (period.length_minutes ? `${period.length_minutes}min` : '')
        
        const row = [periodName, periodTime]
        DAYS.forEach((day, idx) => {
          const entry = entries.find(e => e.day_of_week === idx && e.period_id === period.id)
          if (entry) {
            row.push(`${entry.subject_name} (${entry.teacher_name})`)
          } else {
            row.push('-')
          }
        })
        csvContent += row.join(',') + '\n'
      })
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `timetable_${selectedGradeName?.replace(/\s+/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t('success_csv'))
  }

  const handleDownloadPDF = () => {
    if (!selectedGrade || filteredSections.length === 0) {
      toast.error(t('err_select_grade_first'))
      return
    }

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const localizedDays = DAYS.map(d => daysT(d))
    // Sort by sort_order (global periods)
    const sortedPeriods = [...periods].sort((a, b) => a.sort_order - b.sort_order)

    // Determine which sections to include based on view mode
    const sectionsToExport = viewMode === 'grid'
      ? filteredSections
      : [filteredSections.find(s => s.id === (expandedSection || filteredSections[0]?.id))].filter(Boolean) as typeof filteredSections

    if (sectionsToExport.length === 0) {
      toast.error(t('err_no_section'))
      return
    }

    const pdf = new jsPDF({
      orientation: viewMode === 'grid' && sectionsToExport.length > 1 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    let yPos = 15

    // Title
    pdf.setFontSize(16)
    pdf.setTextColor(2, 33, 114)
    const title = viewMode === 'grid' 
      ? t('pdf_title_all', { grade: selectedGradeName })
      : t('pdf_title_single', { grade: selectedGradeName, section: sectionsToExport[0]?.name })
    pdf.text(title, pdfWidth / 2, yPos, { align: 'center' })
    yPos += 5

    pdf.setFontSize(10)
    pdf.setTextColor(100)
    pdf.text(`${t('filter_year')}: ${academicYears.find(y => y.id === selectedAcademicYear)?.name}`, pdfWidth / 2, yPos, { align: 'center' })
    yPos += 10

    sectionsToExport.forEach((section, sectionIndex) => {
      const entries = sectionEntries[section.id] || []

      if (sectionIndex > 0) {
        yPos += 10
        if (yPos > 250) {
          pdf.addPage()
          yPos = 15
        }
      }

      // Section header
      pdf.setFontSize(12)
      pdf.setTextColor(2, 33, 114)
      pdf.text(`Section: ${section.name}`, 14, yPos)
      yPos += 5

      // Build table data
      const tableHead = [[t('csv_time'), ...localizedDays]]
      const tableBody: string[][] = []

      sortedPeriods.forEach(period => {
        const row: string[] = []
        const periodName = period.title || period.short_name || `P${period.sort_order}`
        const periodTime = formatTimeRange(period.start_time, period.end_time) || (period.length_minutes ? `${period.length_minutes}min` : '')
        row.push(`${periodTime}\n${periodName}`)

        DAYS.forEach((_, dayIdx) => {
          const entry = entries.find(e => e.day_of_week === dayIdx && e.period_id === period.id)
          if (entry) {
            row.push(`${entry.subject_name}\n${entry.teacher_name}`)
          } else {
            row.push('-')
          }
        })
        tableBody.push(row)
      })

      // Use autoTable
      autoTable(pdf, {
        startY: yPos,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [2, 33, 114], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 25 } },
        styles: { overflow: 'linebreak', halign: 'center', valign: 'middle' },
        margin: { left: 10, right: 10 }
      })

      yPos = (pdf as any).lastAutoTable.finalY + 5
    })

    const filename = viewMode === 'grid'
      ? `timetable_${selectedGradeName?.replace(/\s+/g, '_')}_all_sections.pdf`
      : `timetable_${selectedGradeName?.replace(/\s+/g, '_')}_${sectionsToExport[0]?.name}.pdf`

    pdf.save(filename)
    toast.success(t('success_pdf'))
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={!selectedGrade || filteredSections.length === 0}
            title={viewMode === 'grid' ? t('tip_download_pdf_all') : t('tip_download_pdf_single')}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t('btn_pdf')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            disabled={!selectedGrade || filteredSections.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {t('btn_csv')}
          </Button>
          <Link href="/admin/periods">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              {t('btn_manage_periods')}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllSectionTimetables}
            disabled={loadingEntries}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingEntries ? 'animate-spin' : ''}`} />
            {t('btn_refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-sm">{t('filter_year')}</Label>
              <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholder_year')} />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(year => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name} {year.is_current && t('current_label')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-sm">{t('filter_grade')}</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder={t('placeholder_grade')} />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels
                    .filter(g => g.is_active && 
                      (selectedCampus && (g.campus_id === selectedCampus.id || g.school_id === selectedCampus.id))
                    )
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(grade => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t('filter_view_mode')}</Label>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  className={viewMode === 'grid' ? 'bg-[#022172]' : ''}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  {t('view_overview')}
                </Button>
                <Button
                  variant={viewMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  className={viewMode === 'single' ? 'bg-green-600' : ''}
                  onClick={() => setViewMode('single')}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {t('view_builder')}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t('filter_layout')}</Label>
              <div className="flex gap-1">
                <Button
                  variant={orientation === 'vertical' ? 'default' : 'outline'}
                  size="sm"
                  className={orientation === 'vertical' ? 'bg-[#022172]' : ''}
                  onClick={() => setOrientation('vertical')}
                  title={t('layout_vertical_tip')}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('layout_vertical')}
                </Button>
                <Button
                  variant={orientation === 'horizontal' ? 'default' : 'outline'}
                  size="sm"
                  className={orientation === 'horizontal' ? 'bg-[#022172]' : ''}
                  onClick={() => setOrientation('horizontal')}
                  title={t('layout_horizontal_tip')}
                >
                  <RotateCcw className="h-4 w-4 mr-1 rotate-90" />
                  {t('layout_horizontal')}
                </Button>
              </div>
            </div>

            {selectedGrade && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm py-1.5">
                  {t('sections_count', { count: filteredSections.length })}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {dataLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedCampus ? (
        /* No Campus Selected */
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">{t('no_campus_title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('no_campus_desc')}
            </p>
          </CardContent>
        </Card>
      ) : !selectedGrade ? (
        /* No Grade Selected */
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">{t('no_grade_title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('no_grade_desc')}
            </p>
          </CardContent>
        </Card>
      ) : filteredSections.length === 0 ? (
        /* No Sections */
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">{t('no_sections_title')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('no_sections_desc', { grade: selectedGradeName })}
            </p>
          </CardContent>
        </Card>
      ) : periods.length === 0 ? (
        /* No Periods Configured */
        <Card>
          <CardContent className="py-16 text-center">
            <Settings className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground">{t('no_periods_title')}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {t('no_periods_desc')}
            </p>
            <Link href="/admin/periods">
              <Button variant="default" className="bg-[#022172]">
                <Settings className="h-4 w-4 mr-2" />
                {t('btn_configure_periods')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* Multi-Section Calendar Grid */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {t('grade_all_sections', { grade: selectedGradeName })}
            </h2>
          </div>

          {viewMode === 'grid' ? (
            /* Grid View - All sections side by side */
            <div className="overflow-x-auto pb-4" ref={gridTimetableRef}>
              <div className="flex gap-4 min-w-min p-2 bg-white">
                {filteredSections.map(section => (
                  <SectionTimetableCard
                    key={section.id}
                    sectionId={section.id}
                    sectionName={section.name}
                    periods={periods}
                    entries={sectionEntries[section.id] || []}
                    isLoading={loadingEntries}
                    isCompact={filteredSections.length > 2}
                    orientation={orientation}
                    onSlotClick={handleSlotClick}
                    onDeleteEntry={handleDeleteEntry}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Builder View - Interactive timetable builder for one section */
            <div ref={singleTimetableRef}>
              {/* Section Navigator */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!expandedSection || filteredSections.findIndex(s => s.id === expandedSection) === 0}
                  onClick={() => {
                    const idx = filteredSections.findIndex(s => s.id === expandedSection)
                    if (idx > 0) setExpandedSection(filteredSections[idx - 1].id)
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Select
                  value={expandedSection || filteredSections[0]?.id || ''}
                  onValueChange={setExpandedSection}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder={t('placeholder_select_section')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSections.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({t('classes_count', { count: (sectionEntries[s.id] || []).length })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!expandedSection || filteredSections.findIndex(s => s.id === expandedSection) === filteredSections.length - 1}
                  onClick={() => {
                    const idx = filteredSections.findIndex(s => s.id === expandedSection)
                    if (idx < filteredSections.length - 1) setExpandedSection(filteredSections[idx + 1].id)
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Timetable Builder Component */}
              {(expandedSection || filteredSections[0]) && (() => {
                const currentSection = sections.find(s => s.id === (expandedSection || filteredSections[0].id))
                return (
                  <TimetableBuilder
                    sectionId={expandedSection || filteredSections[0].id}
                    sectionName={currentSection?.name || ''}
                    gradeName={selectedGradeName}
                    gradeId={currentSection?.grade_level_id}
                    periods={periods}
                    entries={sectionEntries[expandedSection || filteredSections[0].id] || []}
                    academicYearId={selectedAcademicYear}
                    isLoading={loadingEntries}
                    orientation={orientation}
                    onEntriesChange={loadAllSectionTimetables}
                  />
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* Assign Slot Dialog */}
      {selectedSlot && (
        <AssignSlotDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          sectionId={selectedSlot.sectionId}
          sectionName={selectedSlot.sectionName}
          day={selectedSlot.day}
          period={selectedSlot.period}
          academicYearId={selectedAcademicYear}
          existingEntry={selectedSlot.existingEntry}
          onSave={loadAllSectionTimetables}
        />
      )}
    </div>
  )
}
