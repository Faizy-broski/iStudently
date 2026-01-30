'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { FinancialCenter } from '@/components/parent/FinancialCenter'
import { AcademicProgress } from '@/components/parent/AcademicProgress'
import { DigitalDiary } from '@/components/parent/DigitalDiary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, BookOpen, ClipboardList } from 'lucide-react'

export default function ParentDashboardPage() {
  return (
    <ParentDashboardLayout>
      {/* Tabbed Content */}
      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financial Center
          </TabsTrigger>
          <TabsTrigger value="academic" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Academic Progress
          </TabsTrigger>
          <TabsTrigger value="homework" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Digital Diary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="mt-6">
          <FinancialCenter />
        </TabsContent>

        <TabsContent value="academic" className="mt-6">
          <AcademicProgress />
        </TabsContent>

        <TabsContent value="homework" className="mt-6">
          <DigitalDiary />
        </TabsContent>
      </Tabs>
    </ParentDashboardLayout>
  )
}
