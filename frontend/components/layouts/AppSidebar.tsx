'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarMenuItem } from '@/config/sidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

// --- Context & Provider (Same as before) ---
interface AppSidebarProps {
  menuItems: SidebarMenuItem[]
  className?: string
}

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  isMobileOpen: boolean
  setIsMobileOpen: (open: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined)

export function useSidebarContext() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebarContext must be used within SidebarProvider')
  }
  return context
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        isMobileOpen,
        setIsMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

// --- Updated Sidebar Item Component ---
function SidebarItem({
  item,
  isActive,
  isCollapsed,
}: {
  item: SidebarMenuItem
  isActive: boolean
  isCollapsed: boolean
}) {
  const Icon = item.icon

  return (
   
<Link
  href={item.href}
  className={cn(
    'sidebar-link group relative flex items-center gap-3 px-4 py-3 transition-all duration-200', 
    isActive ? 'active' : 'text-white/90 hover:bg-white/10 hover:text-white rounded-l-full', // Added rounded-l-full to hover state
    isCollapsed ? 'justify-center px-2' : ''
  )}
>
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 transition-colors z-20 relative',
          isActive ? 'text-[#022172]' : 'text-white/80 group-hover:text-white'
        )}
      />
      
      {!isCollapsed && (
        <span className="text-sm truncate z-20 relative font-medium">
          {item.title}
        </span>
      )}
      
      {/* Orange Dot Indicator */}
      {isActive && !isCollapsed && (
        <div className="ml-auto w-2 h-2 bg-[#EEA831] rounded-full z-20 relative" />
      )}
    </Link>
  )
}

// --- Updated Desktop Sidebar ---
function DesktopSidebar({ menuItems, className }: AppSidebarProps) {
  const pathname = usePathname()
  const { isCollapsed, setIsCollapsed } = useSidebarContext()

 return (
    <aside
      className={cn(
        // CHANGED: h-screen -> min-h-screen
        'hidden lg:flex flex-col min-h-screen sticky top-0 transition-all duration-300 ease-in-out pb-10',
        'sidebar-gradient relative z-40', 
        isCollapsed ? 'w-20' : 'w-72',
        className
      )}
    >
      {/* Background Image Overlay */}
      <div
        className="absolute inset-0 opacity-10 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: 'url(/images/sidebar-bg.svg)' }}
      />

      {/* Collapse Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-6 -right-3 z-50 h-6 w-6 rounded-full bg-white shadow-md hover:bg-gray-100 text-[#022172] border border-gray-100"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        
        {/* Logo Section */}
        <div className={cn(
          'flex items-center gap-3 p-6 mb-4',
          isCollapsed ? 'justify-center px-2' : ''
        )}>
          <div className="relative w-10 h-10 shrink-0">
            <Image
              src="/images/logo.svg"
              alt="Studently Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg tracking-tight leading-none">
                ISTUDENTS.LY
              </span>
              <span className="text-white/60 text-[10px] mt-1 uppercase tracking-wider">Education ERP</span>
            </div>
          )}
        </div>

        {/* Navigation Menu - IMPORTANT: pr-0 allows active item to touch right edge */}
        <nav className="flex-1 overflow-y-auto overflow-x-visible py-2 pl-3 pr-0 space-y-2 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className={cn(
          'p-4 border-t border-white/10 text-center mx-4',
          isCollapsed ? 'px-2 mx-2' : ''
        )}>
          {!isCollapsed && (
            <p className="text-white/40 text-[10px]">
              © 2026 istudents.ly
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}

// --- Mobile Sidebar (Simplified to match) ---
function MobileSidebar({ menuItems }: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobileOpen, setIsMobileOpen } = useSidebarContext()

  return (
    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden fixed top-4 left-4 z-50 bg-white shadow-md hover:bg-gray-100 rounded-full"
        >
          <Menu className="h-5 w-5 text-[#022172]" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 sidebar-gradient border-r-0"
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        
        {/* Background Overlay */}
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: 'url(/images/sidebar-bg.svg)' }}
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between p-6 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8">
                <Image
                  src="/images/logo.svg"
                  alt="Studently Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-white font-bold text-lg">ISTUDENTS.LY</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileOpen(false)}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto pl-3 pr-0 space-y-2">
            {menuItems.map((item) => (
              <SidebarItem
                key={item.href}
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                isCollapsed={false}
              />
            ))}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function AppSidebar({ menuItems, className }: AppSidebarProps) {
  return (
    <>
      <DesktopSidebar menuItems={menuItems} className={className} />
      <MobileSidebar menuItems={menuItems} />
    </>
  )
}