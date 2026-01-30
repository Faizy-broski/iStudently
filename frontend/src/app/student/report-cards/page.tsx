'use client'

import { FileText, Download } from 'lucide-react'

export default function ReportCardsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Report Cards</h1>
        <p className="text-gray-600 mt-1">View and download your academic reports</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Report Cards Coming Soon</h3>
        <p className="text-gray-600 mb-4">Your term reports and progress cards will be available here</p>
        <p className="text-sm text-gray-500">Check back after your exams are completed</p>
      </div>
    </div>
  )
}
