'use client'

import * as React from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useAcademic, Quarter } from '@/context/AcademicContext'
import { useRouter } from 'next/navigation'
import { useSidebarContext } from '@/components/layouts/AppSidebar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, LogOut, Settings, Menu, Moon, Sun, Languages, LayoutDashboard, Users, BookOpen, Calendar, FileText, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/portal'
import { useTransition } from 'react'
import { setUserLocale } from '@/actions/locale'
import { useLocale } from 'next-intl'
import { getSidebarConfig } from '@/config/sidebar'

interface TopbarProps {
  className?: string
}

export function Topbar({ className }: TopbarProps) {
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const { setIsMobileOpen } = useSidebarContext()
  const locale = useLocale()
  const [localePending, startLocaleTransition] = useTransition()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)

  // Get all menu items including submenu items based on user role
  const buildFlattenedMenuItems = () => {
    if (!profile?.role) return []
    const sidebarItems = getSidebarConfig(profile.role as any)
    const flattened: any[] = []

    const flatten = (items: any[], parentTitle?: string) => {
      items.forEach((item) => {
        if (item.isLabel) return // Skip label items
        const itemTitle = item.title.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        const displayTitle = parentTitle ? `${parentTitle} > ${itemTitle}` : itemTitle
        
        // Only add items that have a parentTitle (submenu items only)
        if (parentTitle) {
          flattened.push({
            title: displayTitle,
            originalTitle: itemTitle,
            url: item.href,
            icon: item.icon || FileText,
            fullPath: displayTitle,
          })
        }
        
        if (item.subItems) {
          flatten(item.subItems, itemTitle)
        }
      })
    }

    flatten(sidebarItems)
    return flattened
  }

  const allMenuItems = React.useMemo(() => buildFlattenedMenuItems(), [profile?.role, locale])

  // Filter menu items based on search query
  const filteredItems = allMenuItems.filter(item =>
    item.fullPath.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleLocaleToggle = () => {
    const next = locale === 'en' ? 'ar' : 'en'
    startLocaleTransition(async () => {
      await setUserLocale(next as 'en' | 'ar')
      window.location.reload()
    })
  }

  const handleMenuItemClick = (url: string) => {
    router.push(url)
    setSearchQuery('')
    setIsSearchOpen(false)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase()
    }
    return 'U'
  }

  const getRoleDisplayName = () => {
    if (!profile?.role) return ''
    return profile.role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors',
        className
      )}
    >
      <div className="flex items-center justify-between h-16 px-3 md:px-6">
        {/* Left Side - Mobile Menu & Search */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden -ml-2 h-10 w-10 flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>

          {/* Search Bar with Dropdown */}
          <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <div className="hidden md:flex items-center">
              <PopoverTrigger asChild>
                <button className="relative w-64 lg:w-80 text-left">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
                  <input
                    type="text"
                    placeholder="Search pages..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                    }}
                    onClick={() => setIsSearchOpen(true)}
                    className="h-10 w-full ps-10 pe-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#57A3CC] focus:border-transparent transition-all"
                  />
                </button>
              </PopoverTrigger>
            </div>
            <PopoverContent className="w-96 p-0 max-h-[400px] overflow-hidden flex flex-col z-50" align="start">
              <div className="flex-1 overflow-y-auto">
                {filteredItems.length > 0 ? (
                  <div className="py-1">
                    {filteredItems.map((item) => {
                      const IconComponent = item.icon
                      return (
                        <button
                          key={item.fullPath}
                          onClick={() => handleMenuItemClick(item.url)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          <IconComponent className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          <span className="flex-1 truncate">{item.fullPath}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : searchQuery ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No pages found for "{searchQuery}"
                  </div>
                ) : (
                  <div className="py-1">
                    {allMenuItems.length === 0 ? (
                      <div className="px-4 py-4 text-center text-sm text-gray-500">Loading...</div>
                    ) : (
                      allMenuItems.map((item) => {
                        const IconComponent = item.icon
                        return (
                          <button
                            key={item.fullPath}
                            onClick={() => handleMenuItemClick(item.url)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                          >
                            <IconComponent className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                            <span className="flex-1 truncate">{item.fullPath}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right Side - Theme Toggle, Notifications & Profile */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle Theme</span>
          </Button>

          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLocaleToggle}
            disabled={localePending}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 relative"
            title={locale === 'en' ? 'Switch to Arabic' : 'Switch to English'}
          >
            <Languages className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -end-0.5 text-[9px] font-bold leading-none bg-[#022172] text-white rounded px-0.5">
              {locale === 'en' ? 'ع' : 'EN'}
            </span>
            <span className="sr-only">Toggle Language</span>
          </Button>

          {/* Notifications */}
          <NotificationBell className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100" />

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 px-2 py-1.5 h-auto hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={profile?.profile_photo_url || profile?.avatar_url || ''}
                    alt={profile?.first_name || 'User'}
                  />
                  <AvatarFallback className="bg-[#022172] text-white text-sm">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {profile?.first_name} {profile?.last_name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getRoleDisplayName()}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{profile?.first_name} {profile?.last_name}</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    {profile?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="h-4 w-4 me-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4 me-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
