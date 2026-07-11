"use client"

import { MessageCompose } from "@/components/messaging/MessageCompose"

export default function StudentMessagingWritePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Write Message</h1>
      </div>
      <MessageCompose inboxHref="/student/messaging" />
    </div>
  )
}
