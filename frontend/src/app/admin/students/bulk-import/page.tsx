"use client"

import { StudentBulkImport } from "@/components/admin/StudentBulkImport"

export default function StudentBulkImportPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Import Students</h1>
        <p className="text-muted-foreground mt-1">
          Import multiple students at once using a CSV or Excel file.
        </p>
      </div>
      <StudentBulkImport />
    </div>
  )
}
