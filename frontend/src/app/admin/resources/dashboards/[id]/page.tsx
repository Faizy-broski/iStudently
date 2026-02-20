'use client'

import { useEffect, useRef, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Settings, AlertCircle, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import * as dashboardsApi from '@/lib/api/dashboards'
import type { DashboardElement } from '@/lib/api/dashboards'

/**
 * Renders a single dashboard element as an iframe.
 * Supports auto-refresh and custom CSS injection.
 */
function DashboardIframe({ element }: { element: DashboardElement }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Auto-refresh: reload iframe src every N minutes
  useEffect(() => {
    if (!element.refresh_minutes || element.refresh_minutes < 1) return

    const intervalMs = element.refresh_minutes * 60 * 1000
    const interval = setInterval(() => {
      if (iframeRef.current) {
        // Reload by reassigning src
        const currentSrc = iframeRef.current.src
        iframeRef.current.src = currentSrc
      }
    }, intervalMs)

    return () => clearInterval(interval)
  }, [element.refresh_minutes])

  // Inject custom CSS into iframe once loaded
  const handleLoad = useCallback(() => {
    if (!element.custom_css || !iframeRef.current) return

    try {
      const iframeDoc =
        iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
      if (iframeDoc) {
        const style = iframeDoc.createElement('style')
        style.textContent = element.custom_css
        iframeDoc.head.appendChild(style)
      }
    } catch {
      // Cross-origin iframes can't be accessed — CSS injection silently skipped
    }
  }, [element.custom_css])

  // Build the URL — if it starts with / it's internal, otherwise external
  const url = element.url.startsWith('http')
    ? element.url
    : element.url.startsWith('/')
    ? element.url
    : `/${element.url}`

  return (
    <div
      style={{
        width: `${element.width_percent}%`,
        display: 'inline-block',
        verticalAlign: 'top',
      }}
    >
      <iframe
        ref={iframeRef}
        src={url}
        title={element.title || element.url}
        style={{
          width: '100%',
          height: `${element.height_px}px`,
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
        }}
        onLoad={handleLoad}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
      />
    </div>
  )
}

export default function DashboardViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dashboardId } = use(params)
  useAuth()
  const router = useRouter()

  const { data: dashboard, isLoading } = useSWR(
    dashboardId ? ['dashboard-view', dashboardId] : null,
    () => dashboardsApi.getDashboardById(dashboardId),
    { revalidateOnFocus: false }
  )

  const elements = dashboard?.elements || []

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-3" />
          <h2 className="text-xl font-semibold mb-2">Dashboard not found</h2>
          <p className="text-muted-foreground mb-4">
            This dashboard may have been deleted or you don&apos;t have access.
          </p>
          <Button variant="outline" onClick={() => router.push('/admin/resources/dashboards')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboards
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/resources/dashboards')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7" />
            {dashboard.title}
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/admin/resources/dashboards/${dashboardId}/configure`)}
        >
          <Settings className="h-4 w-4 mr-1" />
          Configure
        </Button>
      </div>

      {/* Dashboard description */}
      {dashboard.description && (
        <p className="text-sm text-muted-foreground">{dashboard.description}</p>
      )}

      {/* Elements */}
      {elements.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <LayoutDashboard className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <h3 className="font-semibold text-lg mb-2">No elements yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add elements to this dashboard to embed pages and reports.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/resources/dashboards/${dashboardId}/configure`)}
          >
            <Settings className="h-4 w-4 mr-1" />
            Configure Dashboard
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {elements.map((element) => (
            <DashboardIframe key={element.id} element={element} />
          ))}
        </div>
      )}
    </div>
  )
}
