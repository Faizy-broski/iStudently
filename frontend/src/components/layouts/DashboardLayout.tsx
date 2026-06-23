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
import { getEmbeddedResourcesForUser, getEmbeddedResources } from '@/lib/api/embedded-resources'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { PLUGIN_REGISTRY } from '@/config/plugins'
import { LayoutDashboard, Globe, Star } from 'lucide-react'
import { UnsavedChangesProvider } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { useCampus } from '@/context/CampusContext'
import { TourAssistantPanel } from '@/components/setup-assistant/TourAssistantPanel'
import { SidebarThemeProvider } from '@/context/SidebarThemeContext'
import { AgreementGate } from '@/components/agreement/AgreementGate'
import { getLoginLinks, type CustomLink } from '@/lib/api/public-pages'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
  /** Override the role to use for menu items (useful when profile is loading) */
  role?: UserRole
}

function DashboardContent({ children, className, role: overrideRole }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, loading, mustChangePassword } = useAuth()
  const setupCheckedRef = React.useRef(false)
  const checkingSetupRef = React.useRef(false)
  const posterCheckedRef = React.useRef(false)
  const [loginPoster, setLoginPoster] = React.useState<CustomLink | null>(null)
  const [dynamicDashboards, setDynamicDashboards] = React.useState<SidebarMenuItemType[]>([])
  const [dynamicEmbeddedItems, setDynamicEmbeddedItems] = React.useState<SidebarMenuItemType[]>([])
  const [dynamicAdminEmbeddedItems, setDynamicAdminEmbeddedItems] = React.useState<SidebarMenuItemType[]>([])

  // Use override role if provided, otherwise use profile role
  const effectiveRole = overrideRole || profile?.role

  // Campus context — used to scope admin resource fetches to the selected campus
  const campusCtx = useCampus()
  const selectedCampusId = campusCtx?.selectedCampus?.id ?? null

  // Show image poster popup once per login session
  React.useEffect(() => {
    if (!profile?.id || posterCheckedRef.current) return
    posterCheckedRef.current = true
    getLoginLinks().then(res => {
      if (!res.success || !res.data) return
      const poster = res.data.find(l =>
        l.page_type === 'image' &&
        l.isActive &&
        (!l.target_roles?.length || l.target_roles.includes(profile.role))
      )
      if (poster) setLoginPoster(poster)
    }).catch(() => {})
  }, [profile?.id, profile?.role])

  // Redirect to change-password page if admin has set force_password_change flag
  React.useEffect(() => {
    if (loading || !profile) return
    if (pathname?.startsWith('/auth/change-password')) return
    if (mustChangePassword) {
      router.replace('/auth/change-password')
    }
  }, [loading, profile, mustChangePassword, pathname, router])

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

  // Fetch all embedded resources for admin to inject into sidebar
  React.useEffect(() => {
    if (!profile || effectiveRole !== 'admin') return
    let cancelled = false
    getEmbeddedResources(selectedCampusId ?? undefined).then((res) => {
      if (cancelled || !res.success || !res.data) return
      const items: SidebarMenuItemType[] = res.data.map((r) => ({
        title: r.title,
        href: `/admin/resources/embedded/${r.id}`,
        icon: Globe,
      }))
      setDynamicAdminEmbeddedItems(items)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [profile, effectiveRole, selectedCampusId])

  // Fetch embedded resources for non-admin users to inject into sidebar
  React.useEffect(() => {
    if (!profile || !effectiveRole) return
    if (!['student', 'teacher', 'parent'].includes(effectiveRole)) return
    let cancelled = false
    getEmbeddedResourcesForUser().then((res) => {
      if (cancelled || !res.success || !res.data) return
      const rolePrefix = `/${effectiveRole}/resources/embedded`
      const items: SidebarMenuItemType[] = res.data.map((r) => ({
        title: r.title,
        href: `${rolePrefix}/${r.id}`,
        icon: Globe,
      }))
      setDynamicEmbeddedItems(items)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [profile, effectiveRole])

  // Check setup status for admin users
  React.useEffect(() => {
    if (loading || !profile) return
    if (effectiveRole !== 'admin') return
    if (pathname?.startsWith('/admin/setup')) return
    if (setupCheckedRef.current || checkingSetupRef.current) return

    const checkSetup = async () => {
      checkingSetupRef.current = true
      try {
        const status = await getSetupStatus()
        if (!status.isComplete) {
          router.replace('/admin/setup')
        }
      } catch {
        // Silently ignore — don't block the user on network errors
      } finally {
        checkingSetupRef.current = false
        setupCheckedRef.current = true
      }
    }

    checkSetup()
  }, [loading, profile, effectiveRole, pathname, router])

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
    // NOTE: plugin injection runs before dynamic embedded items so the plain
    // "Embedded Resources" management link lands above the Premium Resources label.
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

    // 3. Inject dynamic embedded resources under Premium Resources (after plugins so the
    //    plain "Embedded Resources" management link is already in position above the label)
    const injectEmbedItems = (embed: SidebarMenuItemType[]) => {
      items = items.map((item) => {
        if (item.title === 'resources' && item.subItems) {
          const existingHrefs = new Set(item.subItems.map(s => s.href))
          const newItems = embed.filter(d => !existingHrefs.has(d.href))
          if (newItems.length === 0) return item
          const alreadyHasPremiumLabel = item.subItems.some(s => s.title === 'premium_resources' && s.isLabel)
          const toAppend: SidebarMenuItemType[] = []
          if (!alreadyHasPremiumLabel) {
            toAppend.push({ title: 'premium_resources', href: '#', icon: Star, isLabel: true })
          }
          toAppend.push(...newItems)
          return { ...item, subItems: [...item.subItems, ...toAppend] }
        }
        return item
      })
    }
    if (dynamicAdminEmbeddedItems.length > 0 && effectiveRole === 'admin') {
      injectEmbedItems(dynamicAdminEmbeddedItems)
    }
    if (dynamicEmbeddedItems.length > 0 && effectiveRole && ['student', 'teacher', 'parent'].includes(effectiveRole)) {
      injectEmbedItems(dynamicEmbeddedItems)
    }

    // 4. Apply custom menu order (if plugin active & order saved for this role)
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
  }, [baseMenuItems, dynamicDashboards, dynamicAdminEmbeddedItems, dynamicEmbeddedItems, effectiveRole, isPluginActive, settings])

  // Render dashboard immediately - no loading screens after auth
  // Setup check happens in background and redirects if needed

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppSidebar menuItems={menuItems} />

      <div className={cn(
        'flex-1 flex flex-col transition-all duration-300 min-w-0',
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

      {/* Post-login image poster popup */}
      <Dialog open={!!loginPoster} onOpenChange={(open) => { if (!open) setLoginPoster(null) }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle>{loginPoster?.title}</DialogTitle>
          </DialogHeader>
          {loginPoster?.image_url && (
            <div className="flex items-center justify-center p-4 bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={loginPoster.image_url}
                alt={loginPoster.title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function DashboardLayout({ children, className, role }: DashboardLayoutProps) {
  return (
    <SidebarThemeProvider>
      <SidebarProvider>
        <AgreementGate>
          <UnsavedChangesGuard>
            <DashboardContent className={className} role={role}>
              {children}
            </DashboardContent>
          </UnsavedChangesGuard>
        </AgreementGate>
        <Toaster />
      </SidebarProvider>
    </SidebarThemeProvider>
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
