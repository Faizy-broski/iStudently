"use client"

import { ReactNode } from "react"

export default function SetupLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            {/* Header */}
            <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
                        <span className="text-white font-bold text-lg">S</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">iStudent.ly</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">School Setup</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-8">
                {children}
            </main>
        </div>
    )
}
