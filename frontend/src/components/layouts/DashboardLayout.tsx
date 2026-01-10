'use client'

import * as React from 'react'
import { useAuth } from '@/context/AuthContext'
import { AppSidebar, SidebarProvider } from '@/components/layouts/AppSidebar'
import { Topbar } from '@/components/layouts/Topbar'
import { getMenuItemsByRole } from '@/config/sidebar'
import { cn } from '@/lib/utils'
import { UserRole } from '@/types'
import { Toaster } from '@/components/ui/sonner'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
  /** Override the role to use for menu items (useful when profile is loading) */
  role?: UserRole
}

function DashboardContent({ children, className, role: overrideRole }: DashboardLayoutProps) {
  const { profile, loading } = useAuth()
  
  // Use override role if provided, otherwise use profile role
  const effectiveRole = overrideRole || profile?.role
  const menuItems = effectiveRole ? getMenuItemsByRole(effectiveRole) : []

  // Show loading skeleton for sidebar while auth is loading
  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <div className="hidden lg:flex w-64 sidebar-gradient" />
        <div className="flex-1 flex flex-col">
          <div className="h-16 bg-white border-b" />
          <main className="flex-1 p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
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
