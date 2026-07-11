"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { messagingApi, type MessageListItem, type ThreadMessage, type MessageView } from "@/lib/api/messaging"
import { useMessagingNotifications } from "@/context/MessagingNotificationContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Inbox, Archive, Send as SendIcon, Trash2, ArrowLeft, PenSquare, MailOpen, Mail, Reply } from "lucide-react"

interface MessagingInboxProps {
  writeHref: string
}

const VIEWS: { key: MessageView; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Unread", icon: Inbox },
  { key: "read", label: "Read", icon: MailOpen },
  { key: "archived", label: "Archived", icon: Archive },
  { key: "sent", label: "Sent", icon: SendIcon },
]

function getInitials(name?: string | null): string {
  if (!name || name === "Unknown") return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("")
}

function Avatar({ name }: { name?: string | null }) {
  return (
    <div className="w-10 h-10 shrink-0 rounded-full bg-linear-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center text-white text-sm font-semibold shadow-sm">
      {getInitials(name)}
    </div>
  )
}

export function MessagingInbox({ writeHref }: MessagingInboxProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<MessageView>("inbox")
  const [items, setItems] = useState<MessageListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [openMessageId, setOpenMessageId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadMessage[] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const { unreadCount, refresh: refreshUnreadCount } = useMessagingNotifications()
  const prevUnreadCountRef = useRef(unreadCount)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await messagingApi.listMessages(view)
      if (res.success && res.data) setItems(res.data)
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // The global MessagingNotificationProvider owns the poll interval and the
  // "new message" sound/toast — here we just refresh the visible list when
  // the shared unread count goes up while viewing the Unread tab.
  useEffect(() => {
    if (view === "inbox" && unreadCount > prevUnreadCountRef.current) {
      fetchMessages()
    }
    prevUnreadCountRef.current = unreadCount
  }, [unreadCount, view, fetchMessages])

  const openThread = useCallback(async (id: string) => {
    setOpenMessageId(id)
    const res = await messagingApi.getThread(id)
    if (res.success && res.data) {
      setThread(res.data.messages)
    } else {
      toast.error(res.error || "Failed to load message")
      setOpenMessageId(null)
    }
    fetchMessages()
    refreshUnreadCount()
  }, [fetchMessages, refreshUnreadCount])

  // Deep link support: ?open=<messageId>, used by the topbar notification bell.
  useEffect(() => {
    const openId = searchParams.get("open")
    if (openId) openThread(openId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closeThread = () => {
    setOpenMessageId(null)
    setThread(null)
  }

  const handleArchive = async (id: string) => {
    const res = await messagingApi.archiveMessage(id)
    if (res.success) {
      toast.success("Message archived")
      closeThread()
      fetchMessages()
    } else {
      toast.error(res.error || "Failed to archive message")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const res = await messagingApi.deleteMessage(deleteTarget)
    if (res.success) {
      toast.success("Message deleted")
      const remaining = thread?.filter((m) => m.id !== deleteTarget) || []
      setDeleteTarget(null)
      if (remaining.length === 0) {
        closeThread()
        fetchMessages()
      } else {
        // Re-open via a message that's guaranteed to still exist — the one just
        // deleted (openMessageId) may itself have been the anchor used to load the thread.
        openThread(remaining[0].id)
      }
    } else {
      toast.error(res.error || "You are not allowed to delete this message")
      setDeleteTarget(null)
    }
  }

  const goToReply = (replyToMessageId: string, senderProfileId: string, senderName: string, subject: string) => {
    const params = new URLSearchParams({
      reply_to: senderProfileId,
      reply_name: senderName,
      reply_to_message_id: replyToMessageId,
      subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
    })
    router.push(`${writeHref}?${params.toString()}`)
  }

  const handleQuickReply = (e: React.MouseEvent, item: MessageListItem) => {
    e.stopPropagation()
    goToReply(item.messages.id, item.messages.sender_profile_id, item.sender_name, item.messages.subject)
  }

  if (openMessageId && thread) {
    const last = thread[thread.length - 1]
    const canReply = !thread.every((m) => m.is_own)

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/30">
            <Button variant="ghost" size="sm" onClick={closeThread}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {canReply && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const other = [...thread].reverse().find((m) => !m.is_own) || last
                    goToReply(last.id, other.sender_profile_id, other.sender_name, last.subject)
                  }}
                >
                  <Reply className="h-3.5 w-3.5 mr-1.5" /> Reply
                </Button>
              )}
              {last.status !== "sent" && last.status !== "archived" && (
                <Button variant="outline" size="sm" onClick={() => handleArchive(last.id)}>
                  <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
                </Button>
              )}
            </div>
          </div>

          <div className="divide-y">
            {thread.map((m) => (
              <div key={m.id} className="p-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar name={m.sender_name} />
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{m.sender_name}</span>
                        {m.is_own && <span className="text-muted-foreground"> (you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {m.can_delete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setDeleteTarget(m.id)} title="Delete message">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div
                  className="prose prose-sm max-w-none pl-[52px]"
                  dangerouslySetInnerHTML={{ __html: m.body }}
                />
              </div>
            ))}
          </div>
        </CardContent>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this message?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the message for all recipients. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as MessageView)}>
          <TabsList>
            {VIEWS.map(({ key, label, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="relative">
                <Icon className="h-3.5 w-3.5 mr-1.5" /> {label}
                {key === "inbox" && unreadCount > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button asChild size="sm">
          <Link href={writeHref}>
            <PenSquare className="h-3.5 w-3.5 mr-1.5" /> Write
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-14 text-muted-foreground text-sm">Loading...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
              <Mail className="h-8 w-8 opacity-40" />
              <span className="text-sm">No messages</span>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => {
                const isUnread = item.status === "unread"
                const canQuickReply = view !== "sent"
                return (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                      isUnread ? "bg-primary/3 hover:bg-primary/6" : "hover:bg-muted/40"
                    }`}
                    onClick={() => openThread(item.messages.id)}
                  >
                    <Avatar name={item.sender_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                        <span className={`text-sm truncate ${isUnread ? "font-semibold" : "font-medium"}`}>
                          {item.sender_name}
                        </span>
                      </div>
                      <div className={`text-sm truncate ${isUnread ? "font-medium" : "text-muted-foreground"}`}>
                        {item.messages.subject}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-md">
                        {item.messages.body.replace(/<[^>]+>/g, "").slice(0, 100)}
                      </div>
                    </div>
                    {canQuickReply && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => handleQuickReply(e, item)}
                        title="Reply"
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="text-xs text-muted-foreground whitespace-nowrap self-start pt-0.5">
                      {new Date(item.messages.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
