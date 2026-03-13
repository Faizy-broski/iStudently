import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Public Pages — Studently',
}

/**
 * Public layout — intentionally minimal.
 * No AuthProvider, AcademicProvider, or any session context.
 * Accessible to unauthenticated visitors.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {children}
    </div>
  )
}
