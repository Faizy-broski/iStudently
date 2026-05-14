'use client'

import { ClipboardList, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function StudentRequestsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Requests</h1>
        <p className="text-muted-foreground mt-1">View and submit course scheduling requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Schedule Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium text-lg mb-2">No Active Requests</p>
            <p className="text-muted-foreground text-sm">
              Course selection requests will appear here when the scheduling window is open.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <p className="text-blue-800 dark:text-blue-300 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Contact your school counselor or administrator to submit a scheduling request.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
