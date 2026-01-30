'use client'

import { FolderOpen, File } from 'lucide-react'

export default function MaterialsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Learning Materials</h1>
        <p className="text-gray-600 mt-1">Access lecture slides, notes, and study resources</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Learning Materials Coming Soon</h3>
        <p className="text-gray-600 mb-4">Study materials shared by your teachers will appear here</p>
        <p className="text-sm text-gray-500">Check back regularly for new materials</p>
      </div>
    </div>
  )
}
