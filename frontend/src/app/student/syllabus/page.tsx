'use client'

import { BookOpen, Download } from 'lucide-react'

export default function SyllabusPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Syllabus</h1>
        <p className="text-gray-600 mt-1">Course outlines and curriculum details</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Syllabus Materials Coming Soon</h3>
        <p className="text-gray-600 mb-4">Your course syllabi will be available for download here</p>
        <p className="text-sm text-gray-500">Teachers will upload course outlines soon</p>
      </div>
    </div>
  )
}
