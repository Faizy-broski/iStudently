"use client"

import { StaffBulkImport } from "@/components/admin/StaffBulkImport"

export default function StaffBulkImportPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Import Staff</h1>
        <p className="text-muted-foreground mt-1">
          Import teachers, librarians, counselors, and other staff at once using a CSV or Excel file.
        </p>
      </div>
      <StaffBulkImport />
    </div>
  )
}
