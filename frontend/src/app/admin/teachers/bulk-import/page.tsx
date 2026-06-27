"use client"

import { TeacherBulkImport } from "@/components/admin/TeacherBulkImport"

export default function TeacherBulkImportPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Import Teachers</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CSV or Excel file to create multiple teacher records at once.
        </p>
      </div>
      <TeacherBulkImport />
    </div>
  )
}
