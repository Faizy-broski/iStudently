import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import Papa from "papaparse"
import type { Grievance } from "@/lib/api/grievances"

const COLUMNS = ["Number", "Title", "Category", "Priority", "Status", "Department", "Submitted", "Due Date"]

function toRows(rows: Grievance[]): string[][] {
  return rows.map((g) => [
    g.complaint_number,
    g.title,
    g.category?.name || "",
    g.priority,
    g.status.replace(/_/g, " "),
    g.department || "",
    new Date(g.submitted_at).toLocaleDateString(),
    g.due_date ? new Date(g.due_date).toLocaleDateString() : "",
  ])
}

export function exportGrievancesToPdf(rows: Grievance[], filename = "grievance_report.pdf") {
  const pdf = new jsPDF({ orientation: "landscape" })
  pdf.setFontSize(14)
  pdf.text("Complaints & Grievances Report", 14, 15)
  autoTable(pdf, {
    head: [COLUMNS],
    body: toRows(rows),
    startY: 22,
    styles: { fontSize: 8 },
  })
  pdf.save(filename)
}

export function exportGrievancesToExcel(rows: Grievance[], filename = "grievance_report.xlsx") {
  const worksheet = XLSX.utils.aoa_to_sheet([COLUMNS, ...toRows(rows)])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Grievances")
  XLSX.writeFile(workbook, filename)
}

export function exportGrievancesToCsv(rows: Grievance[], filename = "grievance_report.csv") {
  const csv = Papa.unparse([COLUMNS, ...toRows(rows)])
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
