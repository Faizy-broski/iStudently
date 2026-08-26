"use client"

import SchoolDataImportWizard from "@/components/admin/SchoolDataImportWizard"

export default function ImportSchoolDataPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import School Data</h1>
        <p className="text-muted-foreground mt-1">
          Migrate an entire school in from another system — students, teachers, staff, parents, fees, and payment history — in one workbook.
        </p>
      </div>
      <SchoolDataImportWizard />
    </div>
  )
}
