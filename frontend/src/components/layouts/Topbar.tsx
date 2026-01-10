'use client'

import * as React from 'react'
import { useAuth } from '@/context/AuthContext'
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
import { Bell, Search, LogOut, User, Settings, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopbarProps {
  className?: string
}

export function Topbar({ className }: TopbarProps) {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const { setIsMobileOpen } = useSidebarContext()

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
        'sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left Side - Mobile Menu & Search */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>

          {/* Search Bar */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="h-10 w-64 lg:w-80 pl-10 pr-4 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#57A3CC] focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Right Side - Notifications & Profile */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative text-gray-600 hover:text-gray-900"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            <span className="sr-only">Notifications</span>
          </Button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-3 px-2 py-1.5 h-auto hover:bg-gray-100 rounded-lg"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" alt={profile?.first_name || 'User'} />
                  <AvatarFallback className="bg-[#022172] text-white text-sm">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-900">
                    {profile?.first_name} {profile?.last_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {getRoleDisplayName()}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{profile?.first_name} {profile?.last_name}</span>
                  <span className="text-xs font-normal text-gray-500">
                    {profile?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
