"use client"

import { SendBalances } from "@/components/admin/email/SendBalances"

export default function FeesEmailParentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Balances to Parents</h1>
        <p className="text-muted-foreground mt-1">
          Email personalised balance statements to the parents of selected students. Emails are sent to all linked parent accounts.
        </p>
      </div>
      <SendBalances toParents />
    </div>
  )
}
