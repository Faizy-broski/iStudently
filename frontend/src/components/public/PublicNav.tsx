'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import type { PublicPageId, PublicSchoolInfo } from '@/lib/api/public-pages'
import { ALL_PUBLIC_PAGES } from '@/lib/api/public-pages'
import { LogIn, School } from 'lucide-react'

interface PublicNavProps {
  slug: string
  school: PublicSchoolInfo
  enabledPages: PublicPageId[]
  customPageTitle?: string
}

export default function PublicNav({ slug, school, enabledPages, customPageTitle }: PublicNavProps) {
  const pathname = usePathname()
  const base = `/p/${slug}`

  const pageHref = (id: PublicPageId) => (id === 'school' ? base : `${base}/${id}`)

  const isActive = (id: PublicPageId) => {
    if (id === 'school') return pathname === base
    return pathname.startsWith(`${base}/${id}`)
  }

  const visiblePages = ALL_PUBLIC_PAGES.filter((p) => enabledPages.includes(p.id))

  return (
    <header className="border-b bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-50">
      {/* School branding bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        {school.logo_url && (
          <Image
            src={school.logo_url}
            alt={`${school.name} logo`}
            width={36}
            height={36}
            className="rounded object-contain"
          />
        )}
        {!school.logo_url && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#022172] text-white">
            <School className="h-5 w-5" />
          </div>
        )}
        <span className="font-semibold text-[#022172] dark:text-white text-lg">
          {school.short_name || school.name}
        </span>
      </div>

      {/* Page navigation */}
      <nav className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {/* Login link always first */}
            <li>
              <Link
                href="/auth/login"
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-[#022172] dark:text-gray-400 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5" />
                Login
              </Link>
            </li>

            {/* Divider */}
            <li className="text-gray-200 dark:text-gray-700 select-none px-1">|</li>

            {/* Enabled public pages */}
            {visiblePages.map((page) => (
              <li key={page.id}>
                <Link
                  href={pageHref(page.id)}
                  className={[
                    'block px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
                    isActive(page.id)
                      ? 'border-[#022172] text-[#022172] dark:text-white dark:border-white'
                      : 'border-transparent text-gray-600 hover:text-[#022172] dark:text-gray-400 dark:hover:text-white',
                  ].join(' ')}
                >
                  {page.id === 'custom' ? (customPageTitle || 'Custom') : page.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  )
}
