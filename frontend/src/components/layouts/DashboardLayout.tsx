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
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { PLUGIN_REGISTRY } from '@/config/plugins'
import { LayoutDashboard } from 'lucide-react'
import { UnsavedChangesProvider } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { TourAssistantPanel } from '@/components/setup-assistant/TourAssistantPanel'

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

  // Plugin injection: only for admin role, uses SchoolSettingsContext
  const { isPluginActive, settings } = useSchoolSettings()

  const menuItems = React.useMemo(() => {
    let items = baseMenuItems

    // 1. Inject user-created dashboards into Resources section (existing logic)
    if (dynamicDashboards.length > 0) {
      items = items.map((item) => {
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
    }

    // 2. Inject sidebar items for each active plugin.
    // Injections with no `roles` field default to admin-only (legacy behaviour).
    // Injections with a `roles` array are applied to each listed role.
    if (effectiveRole) {
      for (const plugin of PLUGIN_REGISTRY) {
        if (!isPluginActive(plugin.id)) continue
        for (const injection of plugin.sidebarInjections) {
          const targetRoles = injection.roles && injection.roles.length > 0
            ? injection.roles
            : ['admin']
          if (!targetRoles.includes(effectiveRole as string)) continue
          items = items.map((item) => {
            if (item.title.toLowerCase() === injection.parentTitle.toLowerCase() && item.subItems) {
              const existingHrefs = new Set(item.subItems.map((s) => s.href))
              const newItems = injection.items.filter((ni) => !existingHrefs.has(ni.href))
              if (newItems.length === 0) return item
              return { ...item, subItems: [...item.subItems, ...newItems] }
            }
            return item
          })
        }
      }
    }

    // 3. Apply custom menu order (if plugin active & order saved for this role)
    if (effectiveRole && isPluginActive('custom_menu')) {
      const roleOrder = settings?.custom_menu_order?.[effectiveRole]
      if (roleOrder && roleOrder.length > 0) {
        const itemMap = new Map(items.map((i) => [i.title, i]))
        const ordered: SidebarMenuItemType[] = []
        for (const title of roleOrder) {
          const item = itemMap.get(title)
          if (item) {
            ordered.push(item)
            itemMap.delete(title)
          }
        }
        // Append any sections not in the saved order (new sections, plugin injections)
        for (const item of itemMap.values()) {
          ordered.push(item)
        }
        items = ordered
      }
    }

    return items
  }, [baseMenuItems, dynamicDashboards, effectiveRole, isPluginActive, settings])

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

      {/* Tour Assistant — fixed overlay, persists across all pages */}
      <TourAssistantPanel />
    </div>
  )
}

export function DashboardLayout({ children, className, role }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <UnsavedChangesGuard>
        <DashboardContent className={className} role={role}>
          {children}
        </DashboardContent>
      </UnsavedChangesGuard>
      <Toaster />
    </SidebarProvider>
  )
}

/** Conditionally wraps children with UnsavedChangesProvider when the plugin is active. */
function UnsavedChangesGuard({ children }: { children: React.ReactNode }) {
  const { isPluginActive } = useSchoolSettings()

  if (!isPluginActive('unsaved_changes_warning')) {
    return <>{children}</>
  }

  return <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
}
