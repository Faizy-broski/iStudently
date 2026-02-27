"use client"

import { TimetableImport } from "@/components/admin/TimetableImport"

export default function TimetableImportPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Import Timetable</h1>
        <p className="text-muted-foreground mt-1">
          Import timetable entries in bulk using a CSV or Excel file. Teacher and section conflicts are automatically detected.
        </p>
      </div>
      <TimetableImport />
    </div>
  )
}
