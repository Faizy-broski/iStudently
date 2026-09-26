/**
 * PDF renderer for the monthly attendance sheet (jsPDF + autotable), driven by
 * the same JSON model the Excel export is built from so both always agree.
 *
 * Landscape A4; column widths are computed from the number of day columns so
 * the whole grid always fits ONE PAGE WIDE (long rosters continue on further
 * pages with the two-tier header repeated). Uses the shared Noto Sans Arabic
 * font loader from tableExport.ts so Arabic names render.
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

  const head: CellDef[][] = [
    [
      { content: L.no, rowSpan: 2 },
      { content: L.id, rowSpan: 2 },
      { content: L.name, rowSpan: 2 },
      ...columns.map((c) => ({ content: c.dayName, styles: c.isNonWorking ? { fillColor: NON_WORKING } : {} })),
      ...L.totals.map((t) => ({ content: t, rowSpan: 2 })),
    ],
    columns.map((c) => ({ content: String(c.day).padStart(2, '0'), styles: c.isNonWorking ? { fillColor: NON_WORKING } : {} })),
  ]

  const body: (string | number)[][] = rows.map((r, i) => [
    i + 1,
    r.number,
    r.name,
    ...r.cells,
    ...(blank
      ? ['', '', '', '', '', '']
      : [r.totals.totalPresent, r.totals.totalAbsentUnexcused, r.totals.totalAbsentExcused, r.totals.totalTardy, r.totals.totalHalfDay, `${r.totals.attendanceRate}%`]),
  ])
  if (body.length === 0) body.push(new Array(3 + columns.length + 6).fill(''))

  const dayFrom = 3
  const dayTo = 3 + columns.length - 1
  const columnStyles: Record<number, { cellWidth: number; halign?: 'left' | 'center' | 'right' }> = {
    0: { cellWidth: noW, halign: 'center' },
    1: { cellWidth: idW, halign: 'center' },
    2: { cellWidth: nameW, halign: isAr ? 'right' : 'left' },
  }
  for (let c = dayFrom; c <= dayTo; c++) columnStyles[c] = { cellWidth: dayW, halign: 'center' }
  for (let k = 0; k < 6; k++) columnStyles[dayTo + 1 + k] = { cellWidth: k === 5 ? rateW : totalW, halign: 'center' }

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
      if (data.section !== 'body') return
      const idx = data.column.index
      if (idx >= dayFrom && idx <= dayTo) {
        const col = columns[idx - dayFrom]
        if (col.isNonWorking) {
          data.cell.styles.fillColor = NON_WORKING
        } else {
          const fill = CODE_COLORS[String(data.cell.raw)]
          if (fill) data.cell.styles.fillColor = fill
        }
      }
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
  model.legend.forEach((item, i) => {
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
  sign(margin, L.preparedBy, L.preparedHint)
  sign(margin + half + 6, L.approvedBy, L.approvedHint)
}
