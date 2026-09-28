/**
 * PDF renderer for the monthly attendance sheet (jsPDF + autotable), driven by
 * the same JSON model the Excel export is built from so both always agree.
 *
 * Landscape A4; column widths are computed from the number of day columns so
 * the whole grid always fits ONE PAGE WIDE (long rosters continue on further
 * pages with the two-tier header repeated). Uses the shared Noto Sans Arabic
 * font loader from tableExport.ts so Arabic names render.
 *
 * Arabic sheets mirror the whole grid (day 1 next to the name column, running
 * toward the totals at the far edge) rather than reusing the English left-to-right
 * order — jsPDF has no page-level "RTL" flag the way a spreadsheet view does, so the
 * column order itself is reversed. Day names are rendered as vertical (rotated) text
 * in both locales: at the width a day column has to be to fit 28-31 of them on one
 * page, a horizontal day name (especially Arabic ones, 4-7 letters) doesn't fit and
 * autoTable's ellipsis truncates it to an unreadable fragment.
 */

import jsPDF from 'jspdf'
import autoTable, { type CellDef } from 'jspdf-autotable'
import { ARABIC_FONT_NAME, useUnicodeFont } from './tableExport'
import type { MonthlySheetModel } from '@/lib/api/attendance'

const NON_WORKING: [number, number, number] = [224, 224, 224]
const HEADER_BG: [number, number, number] = [217, 225, 242]
const CODE_COLORS: Record<string, [number, number, number]> = {
  P: [198, 239, 206],
  A: [255, 199, 206],
  EA: [255, 224, 178],
  L: [255, 242, 204],
  HD: [221, 235, 247],
}

const LABELS = {
  en: {
    no: '#', id: 'ID', name: 'Name',
    totals: ['Present', 'Absent', 'Excused', 'Tardy', 'Half-day', 'Rate'],
    academicYear: 'Academic Year', month: 'Month', group: 'Class / Section / Dept.', room: 'Room', supervisor: 'Supervisor / Teacher', workingDays: 'Working days',
    legend: 'Legend', preparedBy: 'Prepared by: Teacher / Supervisor', preparedHint: 'Signature & Date',
    approvedBy: 'Approved by: School Principal / HR Manager', approvedHint: 'Signature & Stamp',
    page: 'Page',
  },
  ar: {
    no: '#', id: 'الرقم', name: 'الاسم',
    totals: ['حضور', 'غياب', 'بعذر', 'تأخر', 'خروج مبكر', 'النسبة'],
    academicYear: 'العام الدراسي', month: 'الشهر', group: 'الصف / الشعبة / القسم', room: 'القاعة', supervisor: 'المشرف / المعلم', workingDays: 'أيام الدوام',
    legend: 'المفتاح', preparedBy: 'أعدّه: المعلم / المشرف', preparedHint: 'التوقيع والتاريخ',
    approvedBy: 'اعتمده: مدير المدرسة / الموارد البشرية', approvedHint: 'التوقيع والختم',
    page: 'صفحة',
  },
}

/** Fetches a logo as a data URL; returns null on any failure (CORS, 404, SVG...). */
async function loadLogo(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!/^image\/(png|jpe?g|webp)/.test(blob.type)) return null
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function exportMonthlySheetPdf(models: MonthlySheetModel[], filename: string): Promise<void> {
  if (models.length === 0) throw new Error('Nothing to export')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await useUnicodeFont(pdf)
  pdf.setFont(ARABIC_FONT_NAME)

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 7
  const usableW = pageW - margin * 2

  for (let m = 0; m < models.length; m++) {
    if (m > 0) pdf.addPage()
    await drawSheet(pdf, models[m], { pageW, pageH, margin, usableW })
  }

  // Page numbers
  const total = pdf.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p)
    pdf.setFontSize(7)
    pdf.setTextColor(120)
    const label = LABELS[models[0].locale].page
    pdf.text(`${label} ${p} / ${total}`, pageW / 2, pageH - 3, { align: 'center' })
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

/** One physical grid column: a fixed slot (#, ID, Name, a total) or one calendar day. */
type ColSlot =
  | { kind: 'no' }
  | { kind: 'id' }
  | { kind: 'name' }
  | { kind: 'day'; dayIndex: number }
  | { kind: 'total'; totalIndex: number }

const DAY_HEADER_H = 15 // mm — tall enough for a rotated day name at 5.5pt

async function drawSheet(
  pdf: jsPDF,
  model: MonthlySheetModel,
  dims: { pageW: number; pageH: number; margin: number; usableW: number }
): Promise<void> {
  const { pageW, pageH, margin, usableW } = dims
  const L = LABELS[model.locale]
  const isAr = model.locale === 'ar'
  const { header, columns, rows } = model
  const blank = model.mode === 'blank'

  // ── Header ────────────────────────────────────────────────────────────
  const logo = await loadLogo(header.logoUrl)
  if (logo) {
    try {
      pdf.addImage(logo, margin, margin, 20, 17, undefined, 'FAST')
    } catch {
      /* unsupported image data — skip the logo */
    }
  }
  pdf.setTextColor(20)
  pdf.setFontSize(14)
  pdf.text(header.schoolName, pageW / 2, margin + 5, { align: 'center' })
  pdf.setFontSize(8)
  pdf.setTextColor(90)
  if (header.address) pdf.text(header.address, pageW / 2, margin + 9.5, { align: 'center' })
  pdf.setFontSize(12)
  pdf.setTextColor(139, 0, 0)
  pdf.text(header.title, pageW / 2, margin + 15, { align: 'center' })

  pdf.setFontSize(8)
  pdf.setTextColor(30)
  const line1 = `${L.academicYear}: ${header.academicYear}     ${L.month}: ${header.monthLabel}     ${L.group}: ${header.groupLabel}`
  const line2 = `${L.room}: ${header.room || '—'}     ${L.supervisor}: ${header.supervisor || '—'}     ${L.workingDays}: ${model.workingDays}`
  pdf.text(line1, pageW / 2, margin + 20, { align: 'center' })
  pdf.text(line2, pageW / 2, margin + 24, { align: 'center' })

  // ── Grid: widths computed so the table is exactly one page wide ──────
  const noW = 6
  const idW = 15
  const totalW = 10.5
  const rateW = 11
  const totalsW = totalW * 5 + rateW
  const nameW = Math.min(46, Math.max(32, usableW * 0.16))
  const dayW = (usableW - noW - idW - nameW - totalsW) / columns.length

  // Left-to-right slot order, same as before. For Arabic the whole row is mirrored
  // (reversed) so physically the grid reads, right to left: #, ID, Name, day 1 ...
  // day N, totals — i.e. the same reading order as English, just starting from the
  // opposite edge of the page, which is what makes an RTL sheet look "normal" rather
  // than English column order with Arabic text dropped in.
  const ltrSlots: ColSlot[] = [
    { kind: 'no' }, { kind: 'id' }, { kind: 'name' },
    ...columns.map((_, i): ColSlot => ({ kind: 'day', dayIndex: i })),
    ...L.totals.map((_, i): ColSlot => ({ kind: 'total', totalIndex: i })),
  ]
  const slots = isAr ? [...ltrSlots].reverse() : ltrSlots

  const widthOf = (slot: ColSlot): number => {
    switch (slot.kind) {
      case 'no': return noW
      case 'id': return idW
      case 'name': return nameW
      case 'day': return dayW
      case 'total': return slot.totalIndex === 5 ? rateW : totalW
    }
  }
  const isNonWorkingSlot = (slot: ColSlot) => slot.kind === 'day' && columns[slot.dayIndex].isNonWorking

  const head: CellDef[][] = [
    slots.map((slot) => {
      if (slot.kind === 'no') return { content: L.no, rowSpan: 2 }
      if (slot.kind === 'id') return { content: L.id, rowSpan: 2 }
      if (slot.kind === 'name') return { content: L.name, rowSpan: 2 }
      if (slot.kind === 'total') return { content: L.totals[slot.totalIndex], rowSpan: 2 }
      // Day-name cell: content left empty and drawn manually (rotated) in didDrawCell —
      // see DAY_HEADER_H comment above for why a plain, unrotated cell can't fit this.
      return { content: '', styles: isNonWorkingSlot(slot) ? { fillColor: NON_WORKING } : {} }
    }),
    slots.map((slot) =>
      slot.kind === 'day'
        ? { content: String(columns[slot.dayIndex].day).padStart(2, '0'), styles: isNonWorkingSlot(slot) ? { fillColor: NON_WORKING } : {} }
        : { content: '' } // filled by the rowSpan cell above; autoTable still wants a placeholder here
    ),
  ]
  // Remove the placeholder cells that fall under a rowSpan — autoTable errors if a
  // spanned position is also given its own cell definition.
  head[1] = head[1].filter((_, i) => slots[i].kind === 'day')

  const body: (string | number)[][] = rows.map((r, i) =>
    slots.map((slot) => {
      switch (slot.kind) {
        case 'no': return i + 1
        case 'id': return r.number
        case 'name': return r.name
        case 'day': return r.cells[slot.dayIndex]
        case 'total':
          if (blank) return ''
          return [r.totals.totalPresent, r.totals.totalAbsentUnexcused, r.totals.totalAbsentExcused, r.totals.totalTardy, r.totals.totalHalfDay, `${r.totals.attendanceRate}%`][slot.totalIndex]
      }
    })
  )
  if (body.length === 0) body.push(slots.map(() => ''))

  const columnStyles: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {}
  slots.forEach((slot, i) => {
    columnStyles[i] = {
      cellWidth: widthOf(slot),
      halign: slot.kind === 'name' ? (isAr ? 'right' : 'left') : 'center',
    }
  })

  autoTable(pdf, {
    head,
    body,
    startY: margin + 27,
    margin: { left: margin, right: margin, bottom: 12 },
    tableWidth: usableW,
    theme: 'grid',
    styles: { font: ARABIC_FONT_NAME, fontSize: 6.5, cellPadding: 0.7, lineWidth: 0.15, lineColor: [128, 128, 128], valign: 'middle', overflow: 'ellipsize' },
    headStyles: { font: ARABIC_FONT_NAME, fontStyle: 'normal', fillColor: HEADER_BG, textColor: 20, halign: 'center', fontSize: 6.5 },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === 'head' && data.row.index === 0) {
        const slot = slots[data.column.index]
        if (slot?.kind === 'day') {
          data.cell.styles.minCellHeight = DAY_HEADER_H
          data.cell.text = [] // suppress default (horizontal) text draw; didDrawCell paints it rotated
        }
        return
      }
      if (data.section !== 'body') return
      const slot = slots[data.column.index]
      if (slot?.kind === 'day') {
        if (columns[slot.dayIndex].isNonWorking) {
          data.cell.styles.fillColor = NON_WORKING
        } else {
          const fill = CODE_COLORS[String(data.cell.raw)]
          if (fill) data.cell.styles.fillColor = fill
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'head' || data.row.index !== 0) return
      const slot = slots[data.column.index]
      if (slot?.kind !== 'day') return
      const dayName = columns[slot.dayIndex].dayName
      if (!dayName) return
      pdf.setFont(ARABIC_FONT_NAME)
      pdf.setFontSize(5.5)
      pdf.setTextColor(20)
      // Rotated 90° (counter-clockwise): the cell's height becomes the text's available
      // length, its width just needs to clear the font's line height — exactly the
      // opposite of what a normal (unrotated) cell offers, which is why this fits when a
      // plain horizontal label in the same cell does not.
      pdf.text(dayName, data.cell.x + data.cell.width / 2 + 1, data.cell.y + data.cell.height / 2, {
        angle: 90,
        align: 'center',
      })
    },
  })

  // ── Legend + sign-off (keep together; new page only if needed) ───────
  let y = ((pdf as any).lastAutoTable?.finalY ?? margin + 30) + 5
  if (y + 32 > pageH - 8) {
    pdf.addPage()
    y = margin + 4
  }

  pdf.setFontSize(7)
  pdf.setTextColor(30)
  pdf.text(`${L.legend}:`, margin, y + 3)
  const itemW = (usableW - 14) / model.legend.length
  // Reversed for Arabic so the first legend entry (Present/حاضر) sits at the page's right
  // edge — the position a right-to-left reader reaches first — matching the mirrored grid.
  const legendItems = isAr ? [...model.legend].reverse() : model.legend
  legendItems.forEach((item, i) => {
    const x = margin + 14 + i * itemW
    pdf.setFillColor(...(CODE_COLORS[item.code] || [255, 255, 255]))
    pdf.setDrawColor(128)
    pdf.rect(x, y, itemW - 2, 5, 'FD')
    pdf.setTextColor(30)
    pdf.text(`${item.code} — ${isAr ? item.ar : item.en}`, x + (itemW - 2) / 2, y + 3.4, { align: 'center' })
  })

  const signY = y + 10
  const half = (usableW - 6) / 2
  const sign = (x: number, title: string, hint: string) => {
    pdf.setDrawColor(128)
    pdf.setFillColor(...HEADER_BG)
    pdf.rect(x, signY, half, 6, 'FD')
    pdf.rect(x, signY + 6, half, 14)
    pdf.setFontSize(8)
    pdf.setTextColor(20)
    pdf.text(title, x + half / 2, signY + 4.2, { align: 'center' })
    pdf.setFontSize(7)
    pdf.setTextColor(120)
    pdf.text(hint, x + half / 2, signY + 18, { align: 'center' })
  }
  // Mirrored for Arabic: "prepared by" (the first thing signed, teacher/supervisor)
  // moves to the page's right edge, "approved by" (principal) to the left.
  const preparedX = isAr ? margin + half + 6 : margin
  const approvedX = isAr ? margin : margin + half + 6
  sign(preparedX, L.preparedBy, L.preparedHint)
  sign(approvedX, L.approvedBy, L.approvedHint)
}
