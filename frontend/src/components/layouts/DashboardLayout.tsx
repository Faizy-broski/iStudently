'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { AppSidebar, SidebarProvider } from '@/components/layouts/AppSidebar'
import { Topbar } from '@/components/layouts/Topbar'
import { getSidebarConfig } from '@/config/sidebar'
import type { SidebarMenuItem as SidebarMenuItemType } from '@/config/sidebar'
import { cn } from '@/lib/utils'
import { UserRole } from '@/types'
import { Toaster } from '@/components/ui/sonner'
import { getSetupStatus } from '@/lib/api/setup-status'
import { getDashboards } from '@/lib/api/dashboards'
import { LayoutDashboard } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
  /** Override the role to use for menu items (useful when profile is loading) */
  role?: UserRole
}

function DashboardContent({ children, className, role: overrideRole }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, loading } = useAuth()
  const [checkingSetup, setCheckingSetup] = React.useState(false)
  const [setupChecked, setSetupChecked] = React.useState(false)
  const [dynamicDashboards, setDynamicDashboards] = React.useState<SidebarMenuItemType[]>([])

  // Use override role if provided, otherwise use profile role
  const effectiveRole = overrideRole || profile?.role

  // Fetch user-created dashboards for the Resources sidebar section
  React.useEffect(() => {
    if (!profile || effectiveRole !== 'admin') return
    let cancelled = false
    getDashboards().then((dashboards) => {
      if (cancelled) return
      const items: SidebarMenuItemType[] = dashboards.map((d) => ({
        title: d.title,
        href: `/admin/resources/dashboards/${d.id}`,
        icon: LayoutDashboard,
      }))
      setDynamicDashboards(items)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [profile, effectiveRole])

  // Check setup status for admin users
  React.useEffect(() => {
    let isMounted = true

    const checkSetup = async () => {
      // Only check for admin role
      if (effectiveRole !== 'admin') {
        if (isMounted) setSetupChecked(true)
        return
      }

      // Don't check if already on setup page
      if (pathname?.startsWith('/admin/setup')) {
        if (isMounted) setSetupChecked(true)
        return
      }

      // Skip if already checked or still loading auth
      if (loading || setupChecked || checkingSetup) return

      if (isMounted) setCheckingSetup(true)
      try {
        const status = await getSetupStatus()
        if (isMounted && !status.isComplete) {
          router.replace('/admin/setup')
          return
        }
      } catch {
        // Silently ignore all errors - don't block the user
      } finally {
        if (isMounted) {
          setCheckingSetup(false)
          setSetupChecked(true)
        }
      }
    }

    if (!loading && profile) {
      checkSetup()
    }

    return () => {
      isMounted = false
    }
  }, [loading, profile, effectiveRole, pathname, router, setupChecked, checkingSetup])

  const baseMenuItems = effectiveRole ? getSidebarConfig(effectiveRole) : []

  // Inject dynamically-created dashboards into the Resources sidebar section
  const menuItems = React.useMemo(() => {
    if (dynamicDashboards.length === 0) return baseMenuItems
    return baseMenuItems.map((item) => {
      if (item.title === 'Resources' && item.subItems) {
        return {
          ...item,
          subItems: [
            ...item.subItems,
            ...dynamicDashboards.filter(
              (d) => !item.subItems!.some((s) => s.href === d.href)
            ),
          ],
        }
      }
      return item
    })
  }, [baseMenuItems, dynamicDashboards])

  // Render dashboard immediately - no loading screens after auth
  // Setup check happens in background and redirects if needed

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppSidebar menuItems={menuItems} />

      <div className={cn(
        'flex-1 flex flex-col transition-all duration-300',
        'lg:ml-0'
      )}>
        <Topbar />

        <main className={cn(
          'flex-1 p-4 md:p-6 lg:p-8',
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}

export function DashboardLayout({ children, className, role }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardContent className={className} role={role}>
        {children}
      </DashboardContent>
      <Toaster />
    </SidebarProvider>
  )
}
