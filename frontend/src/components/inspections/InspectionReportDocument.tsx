import jsPDF from 'jspdf'
import type { EvaluationDetail } from '@/lib/api/inspection-evaluation'
import type { ReportDetail } from '@/lib/api/inspection-report'
import type { CoachingNote } from '@/lib/api/inspection-coaching'

// Draws the report directly with jsPDF's own text/line primitives — no
// html2canvas DOM screenshot involved. Mirrors the working precedent in
// components/parent/ReportCard.tsx (not lib/utils/printLayout.ts's
// popup+html2canvas pipeline, which renders entirely inside a separate
// popup window and never exposes the resulting Blob back to the caller —
// unusable here, since this Blob has to be uploaded to the backend, not
// just shown to the user).

interface GenerateReportPdfInput {
  report: ReportDetail
  evaluation: EvaluationDetail
  notes: CoachingNote[]
  schoolName: string
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  strength: 'Strength',
  area_for_growth: 'Area for Growth',
  action_item: 'Action Item',
}

const SIGNER_ROLE_LABEL: Record<string, string> = {
  teacher: 'Teacher',
  principal: 'Principal/Admin',
  inspector: 'Inspector',
}

export function generateReportPdfBlob({ report, evaluation, notes, schoolName }: GenerateReportPdfInput): Blob {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = pdf.internal.pageSize.width
  const pageHeight = pdf.internal.pageSize.height
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Educational Inspection Report', pageWidth / 2, y, { align: 'center' })
  y += 7
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(schoolName, pageWidth / 2, y, { align: 'center' })
  y += 12

  pdf.setFontSize(10)
  const teacherName = evaluation.teacher ? `${evaluation.teacher.first_name} ${evaluation.teacher.last_name}` : '—'
  pdf.text(`Teacher: ${teacherName}`, margin, y)
  y += 6
  pdf.text(`Overall Score: ${evaluation.overall_score !== null ? `${evaluation.overall_score} / 100` : 'N/A'}`, margin, y)
  y += 6
  pdf.text(`Submitted: ${evaluation.submitted_at ? new Date(evaluation.submitted_at).toLocaleDateString() : '—'}`, margin, y)
  y += 10

  // ── Rubric scores ───────────────────────────────────────────────────────
  const scoreByCriterion = new Map(evaluation.scores.map((s) => [s.criterion_id, s]))

  for (const category of evaluation.rubric_template?.categories || []) {
    ensureSpace(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setFillColor(240, 240, 240)
    pdf.rect(margin, y - 4.5, contentWidth, 7, 'F')
    pdf.text(`${category.name} (${category.weight}%)`, margin + 2, y)
    y += 8

    for (const crit of category.criteria) {
      ensureSpace(10)
      const score = scoreByCriterion.get(crit.id)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const lines = pdf.splitTextToSize(crit.name, contentWidth - 20)
      pdf.text(lines, margin + 2, y)
      pdf.setFont('helvetica', 'bold')
      pdf.text(score ? `${score.score}/5` : '—', pageWidth - margin - 10, y)
      y += lines.length * 5
      if (score?.comment) {
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(8.5)
        const commentLines = pdf.splitTextToSize(score.comment, contentWidth - 4)
        ensureSpace(commentLines.length * 4 + 2)
        pdf.text(commentLines, margin + 4, y)
        y += commentLines.length * 4
      }
      y += 3
    }
    y += 3
  }

  // ── Coaching notes ──────────────────────────────────────────────────────
  if (notes.length > 0) {
    ensureSpace(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Coaching Notes', margin, y)
    y += 7

    for (const note of notes) {
      ensureSpace(10)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9.5)
      pdf.text(`${NOTE_TYPE_LABEL[note.note_type] || note.note_type}:`, margin, y)
      pdf.setFont('helvetica', 'normal')
      const lines = pdf.splitTextToSize(note.content, contentWidth - 30)
      pdf.text(lines, margin + 30, y)
      y += Math.max(lines.length * 4.5, 5) + 2
    }
    y += 4
  }

  // ── Signatures ──────────────────────────────────────────────────────────
  ensureSpace(30)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Signatures', margin, y)
  y += 8

  const signatureByRole = new Map(report.signatures.map((s) => [s.signer_role, s]))
  const colWidth = contentWidth / 3

  for (const [i, role] of (['teacher', 'principal', 'inspector'] as const).entries()) {
    const sig = signatureByRole.get(role)
    const x = margin + i * colWidth
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(SIGNER_ROLE_LABEL[role], x, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    if (sig) {
      pdf.text(sig.typed_full_name, x, y + 6)
      pdf.setFontSize(7.5)
      pdf.text(new Date(sig.attested_at).toLocaleString(), x, y + 11)
    } else {
      pdf.setTextColor(150)
      pdf.text('Pending signature', x, y + 6)
      pdf.setTextColor(0)
    }
  }
  y += 16

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'italic')
  pdf.setTextColor(120)
  pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' })

  return pdf.output('blob')
}
