'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { grievancesApi } from '@/lib/api/grievances'

const UNREAD_POLL_INTERVAL_MS = 30000

interface GrievanceNotificationContextType {
  unreadCount: number
  refresh: () => void
}

const GrievanceNotificationContext = React.createContext<GrievanceNotificationContextType | undefined>(undefined)

export function GrievanceNotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [unreadCount, setUnreadCount] = React.useState(0)
  const lastUnreadCountRef = React.useRef<number | null>(null)

  const poll = React.useCallback(async () => {
    if (!profile) return

    const res = await grievancesApi.getUnreadCount()
    if (!res.success || !res.data) return

    const count = res.data.count
    setUnreadCount(count)

    if (lastUnreadCountRef.current !== null && count > lastUnreadCountRef.current) {
      toast.info(count - lastUnreadCountRef.current === 1 ? 'A complaint was updated' : 'Complaints were updated')
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
    <GrievanceNotificationContext.Provider value={value}>
      {children}
    </GrievanceNotificationContext.Provider>
  )
}

export function useGrievanceNotifications(): GrievanceNotificationContextType {
  const context = React.useContext(GrievanceNotificationContext)
  if (context === undefined) {
    throw new Error('useGrievanceNotifications must be used within a GrievanceNotificationProvider')
  }
  return context
}
