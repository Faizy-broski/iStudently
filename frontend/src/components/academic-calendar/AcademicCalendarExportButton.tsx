'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Printer, Download, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
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
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [events, setEvents] = useState<SchoolEvent[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  // Derive date range from marking periods
  const { startDate, endDate } = (() => {
    const dates = markingPeriods.flatMap(mp => [mp.start_date, mp.end_date]).filter(Boolean) as string[]
    if (!dates.length) return { startDate: undefined, endDate: undefined }
    dates.sort()
    return { startDate: dates[0], endDate: dates[dates.length - 1] }
  })()

  const handleOpen = useCallback(async () => {
    setOpen(true)
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

  const school = (profile as any)?.school
  const schoolName: string    = school?.name || 'School'
  const schoolLogoUrl: string = school?.logo_url || ''
  const schoolAddress: string = school?.address || ''

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
                schoolName={schoolName}
                schoolAddress={schoolAddress}
                schoolLogoUrl={schoolLogoUrl}
                weekStartDay={0}
                weekEndDay={4}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
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
    </>
  )
}
