"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAuth } from "@/context/AuthContext"
import { useGrievanceNotifications } from "@/context/GrievanceNotificationContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MessageSquareWarning } from "lucide-react"
import { cn } from "@/lib/utils"

// Matches the roles that have their own portal page tree in this app
// (frontend/src/app/{role}/...) — "staff" has no dedicated portal today.
const GRIEVANCE_ROLES = ["admin", "teacher", "parent", "student", "librarian"] as const

interface GrievanceNotificationBellProps {
  className?: string
}

export function GrievanceNotificationBell({ className }: GrievanceNotificationBellProps) {
  const t = useTranslations("grievances")
  const router = useRouter()
  const { profile } = useAuth()
  const { unreadCount } = useGrievanceNotifications()

  if (!profile || !GRIEVANCE_ROLES.includes(profile.role as (typeof GRIEVANCE_ROLES)[number])) {
    return null
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      title={t("bell_title")}
      onClick={() => router.push(`/${profile.role}/grievances`)}
    >
      <MessageSquareWarning className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] bg-red-500">
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
      <span className="sr-only">{t("bell_title")}</span>
    </Button>
  )
}
