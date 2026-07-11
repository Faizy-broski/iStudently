'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { messagingApi } from '@/lib/api/messaging'
import { playMessageReceivedSound } from '@/lib/utils/notification-sound'

const UNREAD_POLL_INTERVAL_MS = 20000

interface MessagingNotificationContextType {
  unreadCount: number
  refresh: () => void
}

const MessagingNotificationContext = React.createContext<MessagingNotificationContextType | undefined>(undefined)

export function MessagingNotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [unreadCount, setUnreadCount] = React.useState(0)
  const lastUnreadCountRef = React.useRef<number | null>(null)

  const poll = React.useCallback(async () => {
    if (!profile) return

    const res = await messagingApi.getUnreadCount()
    if (!res.success || !res.data) return

    const count = res.data.count
    setUnreadCount(count)

    if (lastUnreadCountRef.current !== null && count > lastUnreadCountRef.current) {
      playMessageReceivedSound()
      toast.info(count - lastUnreadCountRef.current === 1 ? 'New message received' : 'New messages received')
    }
    lastUnreadCountRef.current = count
  }, [profile])

  React.useEffect(() => {
    if (!profile) {
      setUnreadCount(0)
      lastUnreadCountRef.current = null
      return
    }

    poll()
    const interval = setInterval(poll, UNREAD_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [profile, poll])

  const value = React.useMemo(() => ({ unreadCount, refresh: poll }), [unreadCount, poll])

  return (
    <MessagingNotificationContext.Provider value={value}>
      {children}
    </MessagingNotificationContext.Provider>
  )
}

export function useMessagingNotifications(): MessagingNotificationContextType {
  const context = React.useContext(MessagingNotificationContext)
  if (context === undefined) {
    throw new Error('useMessagingNotifications must be used within a MessagingNotificationProvider')
  }
  return context
}
