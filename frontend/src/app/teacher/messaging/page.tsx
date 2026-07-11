"use client"

import { MessagingInbox } from "@/components/messaging/MessagingInbox"

export default function TeacherMessagingPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messaging</h1>
        <p className="text-muted-foreground mt-1">Send and receive messages.</p>
      </div>
      <MessagingInbox writeHref="/teacher/messaging/write" />
    </div>
  )
}
