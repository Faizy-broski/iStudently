'use client'

import { useAuth } from '@/context/AuthContext'
import { useEffect, useState } from 'react'

/**
 * Global loading guard to prevent components from rendering
 * before authentication state is fully initialized.
 * Production-ready: no error UI, just loading spinner with graceful timeout handling.
 */
export function AuthLoadingGuard({ children }: { children: React.ReactNode }) {
  const { loading, recoverFromError } = useAuth()
  const [showRecoveryOption, setShowRecoveryOption] = useState(false)

  // Show recovery option after 8 seconds of loading (faster feedback)
  useEffect(() => {
    if (!loading) {
      setShowRecoveryOption(false)
      return
    }

    const timeout = setTimeout(() => {
      if (loading) {
        setShowRecoveryOption(true)
      }
    }, 8000) // 8 seconds - faster recovery option

    return () => clearTimeout(timeout)
  }, [loading])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading...</p>
          
          {/* Show recovery option if loading takes too long */}
          {showRecoveryOption && (
            <div className="mt-6 flex flex-col items-center gap-3 animate-fade-in">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Taking longer than expected?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => recoverFromError?.()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Reset Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
