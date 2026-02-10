'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ChevronLeft, ChevronRight, ChevronDown, Calendar, GraduationCap, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarMenuItem } from '@/config/sidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/context/AuthContext'
import { useAcademic, type Quarter } from '@/context/AcademicContext'
import { useCampus } from '@/context/CampusContext'
import { ProfileViewContext } from '@/context/ProfileViewContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'

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

// Academic Year & Quarter Selectors Component
function AcademicSelectors() {
  const { profile } = useAuth()
  const {
    academicYears,
    selectedAcademicYear,
    selectedQuarter,
    setSelectedAcademicYear,
    setSelectedQuarter,
    currentAcademicYear,
    loading
  } = useAcademic()

  // Show for admin and librarian (librarian can toggle but not create)
  if (profile?.role !== 'admin' && profile?.role !== 'librarian') return null

  return (
    <div className="px-3 mb-4 space-y-2">
      {/* Academic Year Selector */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg border border-white/20">
        <GraduationCap className="h-4 w-4 text-white/80 shrink-0" />
        <Select
          value={selectedAcademicYear || ''}
          onValueChange={setSelectedAcademicYear}
          disabled={loading || academicYears.length === 0}
        >
          <SelectTrigger className="h-8 border-0 bg-transparent text-white font-medium text-sm focus:ring-0 hover:bg-white/5 disabled:opacity-50">
            <SelectValue placeholder={loading ? 'Loading...' : (academicYears.length === 0 ? 'No Years' : 'Select Year')}>
              {loading ? 'Loading...' : (currentAcademicYear?.name || (academicYears.length === 0 ? 'No Years' : 'Select Year'))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {academicYears.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-gray-500">
                <p className="mb-2">No academic years found.</p>
                <p className="text-xs">Go to Settings → Academic Years to create one.</p>
              </div>
            ) : (
              academicYears.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  <div className="flex items-center gap-2">
                    <span>{year.name}</span>
                    {year.is_current && (
                      <span className="text-xs text-green-600 font-medium">Current</span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Quarter Selector */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg border border-white/20">
        <Calendar className="h-4 w-4 text-white/80 shrink-0" />
        <Select
          value={selectedQuarter}
          onValueChange={(value) => setSelectedQuarter(value as Quarter)}
        >
          <SelectTrigger className="h-8 border-0 bg-transparent text-white font-medium text-sm focus:ring-0 hover:bg-white/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Quarter 1">Quarter 1</SelectItem>
            <SelectItem value="Quarter 2">Quarter 2</SelectItem>
            <SelectItem value="Quarter 3">Quarter 3</SelectItem>
            <SelectItem value="Quarter 4">Quarter 4</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// Campus Switcher Component (replaces school switcher)
function CampusSelector() {
  const { profile } = useAuth()
  const campusContext = useCampus()

  // Only show for admin
  if (profile?.role !== 'admin' || !campusContext) return null

  const { campuses, selectedCampus, setSelectedCampus, loading } = campusContext

  // Loading state
  if (loading) {
    return (
      <div className="px-3 mb-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg border border-white/20">
          <Building2 className="h-4 w-4 text-white/80 shrink-0 animate-pulse" />
          <span className="text-white/60 text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  // No campuses
  if (campuses.length === 0) {
    return (
      <div className="px-3 mb-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 rounded-lg border border-orange-500/30">
          <Building2 className="h-4 w-4 text-orange-300 shrink-0" />
          <span className="text-orange-200 text-sm">No campuses</span>
        </div>
      </div>
    )
  }

  const handleCampusChange = (campusId: string) => {
    const campus = campuses.find((c) => c.id === campusId)
    if (campus && campus.id !== selectedCampus?.id) {
      setSelectedCampus(campus)
      toast.success(`Switched to ${campus.name}`)
    }
  }

  return (
    <div className="px-3 mb-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg border border-white/20">
        <Building2 className="h-4 w-4 text-white/80 shrink-0" />
        <Select
          value={selectedCampus?.id || ''}
          onValueChange={handleCampusChange}
        >
          <SelectTrigger className="h-8 border-0 bg-transparent text-white font-medium text-sm focus:ring-0 hover:bg-white/5 truncate">
            <SelectValue placeholder="Select Campus">
              {selectedCampus?.name || 'Select Campus'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {campuses.map((campus: any) => (
              <SelectItem key={campus.id} value={campus.id}>
                {campus.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// Viewed Profile Indicator Component
function ViewedProfileIndicator() {
  const router = useRouter()
  
  // Try to use profile view context
  let viewedProfile = null;
  let clearViewedProfile = () => {};
  
  try {
    const context = React.useContext(ProfileViewContext);
    if (context) {
      viewedProfile = context.viewedProfile;
      clearViewedProfile = context.clearViewedProfile;
    }
  } catch {
    // Context not available
  }
  
  if (!viewedProfile) return null
  
  const handleClose = () => {
    clearViewedProfile();
    router.push(viewedProfile.backUrl)
  }
  
  const getIcon = () => {
    switch (viewedProfile.type) {
      case 'student': return <GraduationCap className="h-4 w-4 text-[#EEA831] shrink-0" />
      case 'teacher': return <User className="h-4 w-4 text-[#EEA831] shrink-0" />
      case 'staff': return <User className="h-4 w-4 text-[#EEA831] shrink-0" />
      case 'parent': return <User className="h-4 w-4 text-[#EEA831] shrink-0" />
      default: return <User className="h-4 w-4 text-[#EEA831] shrink-0" />
    }
  }
  
  const getLabel = () => {
    switch (viewedProfile.type) {
      case 'student': return 'Viewing Student'
      case 'teacher': return 'Viewing Teacher'
      case 'staff': return 'Viewing Staff'
      case 'parent': return 'Viewing Parent'
      default: return 'Viewing Profile'
    }
  }
  
  return (
    <div className="px-3 mb-2">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-[#EEA831]/30 to-[#F59E0B]/20 rounded-lg border-2 border-[#EEA831] shadow-lg shadow-[#EEA831]/20">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[#EEA831] font-semibold">{getLabel()}</p>
          <p className="text-white text-sm font-bold truncate">{viewedProfile.name}</p>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 bg-red-500 hover:bg-red-600 rounded-full transition-colors shadow-md"
          title="Close profile view"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  )
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
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = React.useState(() => {
    // Auto-expand if current path matches any subitem
    return item.subItems?.some(subItem => 
      !subItem.isLabel && pathname.startsWith(subItem.href)
    ) ?? false
  })

  const Icon = item.icon
  const hasSubItems = item.subItems && item.subItems.length > 0

  // Check if any subitem is active
  const hasActiveSubItem = item.subItems?.some(subItem =>
    !subItem.isLabel && (pathname === subItem.href || pathname.startsWith(subItem.href + '/'))
  )

  if (hasSubItems && !isCollapsed) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'sidebar-link group relative flex items-center gap-3 px-4 py-3 transition-all duration-200 w-full text-left',
            isActive || hasActiveSubItem ? 'active' : 'text-white/90 hover:bg-white/10 hover:text-white rounded-l-full'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5 shrink-0 transition-colors z-20 relative',
              isActive || hasActiveSubItem ? 'text-[#022172]' : 'text-white/80 group-hover:text-white'
            )}
          />
          <span className="text-sm truncate z-20 relative font-medium flex-1">
            {item.title}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform z-20 relative',
              isActive || hasActiveSubItem ? 'text-[#022172]' : 'text-white/80',
              isExpanded ? 'rotate-180' : ''
            )}
          />
          {(isActive || hasActiveSubItem) && (
            <div className="ml-auto w-2 h-2 bg-[#EEA831] rounded-full z-20 relative" />
          )}
        </button>

        {/* Submenu Items */}
        {isExpanded && item.subItems && (
          <div className="ml-8 mt-1 space-y-1">
            {item.subItems.map((subItem) => {
              const subItemActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/')
              const SubIcon = subItem.icon

              // Render label (non-clickable separator)
              if (subItem.isLabel) {
                return (
                  <div
                    key={subItem.title}
                    className="mt-4 mb-2 px-4"
                  >
                    <div className="flex items-center gap-2 pb-1 border-b border-[#EEA831]/50">
                      <SubIcon className="h-3.5 w-3.5 shrink-0 text-[#EEA831]" />
                      <span className="text-xs font-semibold text-[#EEA831] uppercase tracking-wider">
                        {subItem.title}
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 text-sm transition-all duration-200 rounded-l-full',
                    subItemActive
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <SubIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{subItem.title}</span>
                  {subItemActive && (
                    <div className="ml-auto w-1.5 h-1.5 bg-[#EEA831] rounded-full" />
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'sidebar-link group relative flex items-center gap-3 px-4 py-3 transition-all duration-200',
        isActive ? 'active' : 'text-white/90 hover:bg-white/10 hover:text-white rounded-l-full',
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
          'flex items-center gap-3 p-6 mb-2',
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

        {/* Campus Switcher */}
        {!isCollapsed && <CampusSelector />}

        {/* Academic Year & Quarter Selectors */}
        {!isCollapsed && <AcademicSelectors />}

        {/* Currently Viewed Profile Indicator */}
        {!isCollapsed && <ViewedProfileIndicator />}

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
          <div className="flex items-center justify-between p-6 mb-2">
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

          {/* Campus Switcher */}
          <CampusSelector />

          {/* Academic Year & Quarter Selectors */}
          <AcademicSelectors />

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