'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EventFormDialog } from '@/components/admin/EventFormDialog'
import Link from 'next/link'
import { Printer, Download, Loader2, Pencil, RotateCcw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import { getEvents } from '@/lib/api/events'
import { getGradeLevels, type GradeLevel } from '@/lib/api/academics'
import { AcademicCalendarPrint, type CalendarGrade } from './AcademicCalendarPrint'
import type { MarkingPeriod } from '@/lib/api/marking-periods'
import type { SchoolEvent } from '@/lib/api/events'

interface Props {
  markingPeriods: MarkingPeriod[]
}

export function AcademicCalendarExportButton({ markingPeriods }: Props) {
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const { currentAcademicYear } = useAcademic()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([])
  const printRef = useRef<HTMLDivElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [editingEvent, setEditingEvent] = useState<SchoolEvent | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  const [customYear, setCustomYear] = useState('')
  const [customSchoolName, setCustomSchoolName] = useState('')
  const [customAddress, setCustomAddress] = useState('')
  const [footerNote, setFooterNote] = useState('')

  // Derive date range from marking periods
  const { startDate, endDate } = (() => {
    const dates = markingPeriods.flatMap(mp => [mp.start_date, mp.end_date]).filter(Boolean) as string[]
    if (!dates.length) return { startDate: undefined, endDate: undefined }
    dates.sort()
    return { startDate: dates[0], endDate: dates[dates.length - 1] }
  })()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [evRes, gradeRes] = await Promise.all([
        getEvents({ start_date: startDate, end_date: endDate, limit: 500 }),
        getGradeLevels(),
      ])
      setEvents(evRes.data || [])
      setGradeLevels(gradeRes.data || [])
    } catch {
      // non-fatal — calendar still renders without events
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  const handleOpen = useCallback(async () => {
    setOpen(true)
    await loadData()
  }, [loadData])

  /**
   * Print by injecting the calendar's rendered HTML into a hidden iframe.
   *
   * window.print() would try to print the whole page (including the Dialog
   * overlay). The Radix Dialog renders in a portal at the body root, so any
   * "@media print { body > * { display:none } }" rule kills everything inside
   * it too — resulting in a blank page.
   *
   * The iframe approach bypasses this entirely: we copy the already-rendered,
   * inline-styled HTML into a fresh document, add a minimal print stylesheet
   * (just @page size), and call print() on that isolated window.
   */
  const handlePrint = useCallback(() => {
    const container = printRef.current
    if (!container) return

    setPrinting(true)

    // Give the browser one frame to re-render before we snapshot the DOM
    requestAnimationFrame(() => {
      try {
        // Create a zero-sized hidden iframe
        const iframe = document.createElement('iframe')
        Object.assign(iframe.style, {
          position: 'fixed', top: '0', left: '0',
          width: '1px', height: '1px', border: 'none', opacity: '0',
        })
        document.body.appendChild(iframe)

        const iWin = iframe.contentWindow
        const iDoc = iframe.contentDocument || iWin?.document
        if (!iDoc || !iWin) {
          document.body.removeChild(iframe)
          setPrinting(false)
          return
        }

        iDoc.open()
        iDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Academic Calendar</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 6mm; }
  </style>
</head>
<body>
  ${container.innerHTML}
</body>
</html>`)
        iDoc.close()

        // Wait for images (e.g., school logo) to load before printing
        iWin.onload = () => {
          iWin.focus()
          iWin.print()
          // Delay removal so the browser can finish the print job
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe)
            setPrinting(false)
          }, 1500)
        }

        // Fallback: if onload doesn't fire (no images) start after 300ms
        setTimeout(() => {
          if (!iDoc.readyState || iDoc.readyState === 'complete') {
            iWin.focus()
            iWin.print()
          }
        }, 300)

      } catch (err) {
        console.error('Print failed:', err)
        setPrinting(false)
      }
    })
  }, [])

  const toggleGrade = (id: string) => {
    setSelectedGradeIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  // Prefer the currently-selected campus's own branding (name/logo/address) —
  // admin accounts aren't pinned to a single campus, and `profile.school`
  // only ever carries the root school's name+logo (fetchSchoolBranding in
  // AuthContext.tsx doesn't even select an address column), so a campus
  // admin previously always saw the literal "School" fallback with no logo
  // here regardless of which campus they were actually viewing. Falls back
  // to profile.school for roles/views with no selected campus.
  const school = (profile as any)?.school
  const selectedCampus = campusCtx?.selectedCampus
  const schoolName: string    = selectedCampus?.name || school?.name || 'School'
  const schoolLogoUrl: string = selectedCampus?.logo_url || school?.logo_url || ''
  const schoolAddress: string = selectedCampus?.address || school?.address || ''
  const academicYearLabel: string | undefined = currentAcademicYear?.name

  // Customisations (title, year, school name/address, footer note) are saved
  // per campus in this browser, so an admin's wording survives reopening the
  // preview. localStorage can be unavailable/blocked, so every access is guarded.
  const storageKey = `acal-custom:${selectedCampus?.id ?? 'school'}`
  useEffect(() => {
    if (!open) return
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
      setCustomTitle(saved.title || '')
      setCustomYear(saved.year || '')
      setCustomSchoolName(saved.schoolName || '')
      setCustomAddress(saved.address || '')
      setFooterNote(saved.footerNote || '')
    } catch { /* corrupt or blocked storage — keep defaults */ }
  }, [open, storageKey])

  const saveCustom = (patch: Record<string, string>) => {
    try {
      const cur = JSON.parse(localStorage.getItem(storageKey) || '{}')
      localStorage.setItem(storageKey, JSON.stringify({ ...cur, ...patch }))
    } catch { /* ignore */ }
  }
  const resetCustom = () => {
    setCustomTitle(''); setCustomYear(''); setCustomSchoolName(''); setCustomAddress(''); setFooterNote('')
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }

  const editableEvents = events
    .filter(ev => !ev.target_grades?.length || selectedGradeIds.length === 0 || ev.target_grades.some(g => selectedGradeIds.includes(g)))
    .sort((x, y) => x.start_at.localeCompare(y.start_at))

  const calGrades: CalendarGrade[] = gradeLevels.map(g => ({ id: g.id, name: g.name }))

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="gap-2">
        <Printer className="h-4 w-4" />
        Export Calendar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Academic Calendar Preview</DialogTitle>
          </DialogHeader>

          {/* Grade filter */}
          <div className="flex flex-wrap gap-2 border-b pb-3">
            <Label className="text-sm font-medium self-center mr-2">Grade filter:</Label>
            <Button
              variant={selectedGradeIds.length === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedGradeIds([])}
              className="h-7 text-xs"
            >
              All Grades
            </Button>
            {gradeLevels.map(g => (
              <Button
                key={g.id}
                variant={selectedGradeIds.includes(g.id) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleGrade(g.id)}
                className="h-7 text-xs"
              >
                {g.name}
              </Button>
            ))}
          </div>

          {/* Calendar preview */}
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading calendar data…
            </div>
          ) : (
            <div ref={printRef} className="border rounded-lg overflow-hidden bg-white">
              <AcademicCalendarPrint
                markingPeriods={markingPeriods}
                events={events}
                selectedGradeIds={selectedGradeIds}
                gradeLevels={calGrades}
                schoolName={customSchoolName.trim() || schoolName}
                schoolAddress={customAddress.trim() || schoolAddress}
                schoolLogoUrl={schoolLogoUrl}
                academicYearLabel={customYear.trim() || academicYearLabel}
                calendarTitle={customTitle}
                footerNote={footerNote}
                weekStartDay={0}
                weekEndDay={4}
              />
            </div>
          )}

          {editMode && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Customize calendar</h3>
                <Button variant="ghost" size="sm" onClick={resetCustom} className="gap-1 h-7 text-xs">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input value={customTitle} placeholder="Academic Calendar" maxLength={80}
                    onChange={e => { setCustomTitle(e.target.value); saveCustom({ title: e.target.value }) }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Academic year label</Label>
                  <Input value={customYear} placeholder={academicYearLabel || '2026-2027'} maxLength={40}
                    onChange={e => { setCustomYear(e.target.value); saveCustom({ year: e.target.value }) }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">School name</Label>
                  <Input value={customSchoolName} placeholder={schoolName} maxLength={120}
                    onChange={e => { setCustomSchoolName(e.target.value); saveCustom({ schoolName: e.target.value }) }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address / subtitle</Label>
                  <Input value={customAddress} placeholder={schoolAddress} maxLength={160}
                    onChange={e => { setCustomAddress(e.target.value); saveCustom({ address: e.target.value }) }} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note printed under &quot;Dates to remember&quot;</Label>
                <Textarea value={footerNote} rows={2} maxLength={500}
                  onChange={e => { setFooterNote(e.target.value); saveCustom({ footerNote: e.target.value }) }} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Events on this calendar ({editableEvents.length})</h3>
                {editableEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No events in this date range.</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-md border divide-y">
                    {editableEvents.map(ev => (
                      <div key={ev.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ev.color_code || '#3b82f6' }} />
                        <span className="flex-1 truncate">{ev.title}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {ev.start_at.slice(0, 10)}{ev.end_at.slice(0, 10) !== ev.start_at.slice(0, 10) ? ` → ${ev.end_at.slice(0, 10)}` : ''}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setEditingEvent(ev)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This calendar is built from the marking period dates and the School Events &amp; Calendar.
            Weekends (outside the school week) stay grey, and each event category is shown in its own colour.
          </p>

          <DialogFooter className="gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link href="/admin/events/list"><Pencil className="h-4 w-4" /> Manage all events</Link>
            </Button>
            <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(m => !m)} className="gap-2">
              <Pencil className="h-4 w-4" /> {editMode ? 'Done editing' : 'Edit calendar'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={handlePrint} className="gap-2" disabled={loading || printing}>
              {printing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</>
                : <><Download className="h-4 w-4" /> Print / Save as PDF</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventFormDialog
        open={editingEvent !== null}
        onOpenChange={(o) => { if (!o) setEditingEvent(null) }}
        event={editingEvent}
        onSuccess={() => { setEditingEvent(null); loadData() }}
      />
    </>
  )
}
