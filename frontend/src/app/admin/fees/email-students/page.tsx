"use client"

import { SendBalances } from "@/components/admin/email/SendBalances"

export default function FeesEmailStudentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Balances</h1>
        <p className="text-muted-foreground mt-1">
          Email personalised balance statements to selected students. Use <code>{"{{balance}}"}</code> and <code>{"{{fees_list}}"}</code> to include fee details.
        </p>
      </div>
      <SendBalances />
    </div>
  )
}
