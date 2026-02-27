"use client"

import { SendDisciplineLog } from "@/components/admin/email/SendDisciplineLog"

export default function DisciplineEmailStudentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Discipline Log</h1>
        <p className="text-muted-foreground mt-1">
          Email personalised discipline logs to selected students. Choose which fields to include and which academic year to filter by.
        </p>
      </div>
      <SendDisciplineLog />
    </div>
  )
}
