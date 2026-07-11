"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useMessagingNotifications } from "@/context/MessagingNotificationContext"
import { messagingApi, type MessageListItem } from "@/lib/api/messaging"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Mail, Loader2 } from "lucide-react"

const MESSAGING_ROLES = ["admin", "teacher", "parent", "student"] as const

interface MessagingNotificationBellProps {
  className?: string
}

export function MessagingNotificationBell({ className }: MessagingNotificationBellProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const { unreadCount, refresh } = useMessagingNotifications()

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MessageListItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchPreview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await messagingApi.listMessages("inbox", 1, 5)
      if (res.success && res.data) setItems(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchPreview()
  }, [open, fetchPreview])

  if (!profile || !MESSAGING_ROLES.includes(profile.role as (typeof MESSAGING_ROLES)[number])) {
    return null
  }

  const inboxHref = `/${profile.role}/messaging`

  const openMessage = (id: string) => {
    setOpen(false)
    router.push(`${inboxHref}?open=${id}`)
  }

  const handleViewAll = () => {
    setOpen(false)
    router.push(inboxHref)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)} title="Messages">
          <Mail className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] bg-red-500">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Messages</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-[#022172]">Messages</h4>
            <p className="text-sm text-muted-foreground">Unread messages</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { fetchPreview(); refresh() }} disabled={loading} className="h-8 w-8">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="h-72">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No unread messages</div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors bg-blue-50/60 dark:bg-blue-950/20 border-l-2 border-[#022172]"
                  onClick={() => openMessage(item.messages.id)}
                >
                  <p className="font-medium text-sm truncate">{item.sender_name}</p>
                  <p className="text-sm truncate">{item.messages.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.messages.body.replace(/<[^>]+>/g, "").slice(0, 80)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Button variant="ghost" className="w-full text-[#022172]" onClick={handleViewAll}>
            View All Messages{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
