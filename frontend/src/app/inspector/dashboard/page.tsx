'use client';

import { useEffect, useState } from 'react'
import { Loader2, ClipboardCheck, Building2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { getMyAssignedSchools } from '@/lib/api/inspectors'

// Inspector Dashboard — Phase 0 shell. Upgraded with real stat cards, the
// visits-vs-target chart, avg rubric score, open appeals and the score
// heatmap in Phase 6, once those data sources exist.
export default function InspectorDashboard() {
  const { profile } = useAuth()
  const firstName = profile?.first_name || 'Inspector'

  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMyAssignedSchools().then((res) => {
      if (cancelled) return
      if (res.error) {
        setError(res.error)
      } else {
        setSchools(res.data || [])
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {firstName}</h1>
        <p className="text-sm text-gray-500 mt-1">Your inspection dashboard</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-[#022172]" />
            Assigned Campuses
          </CardTitle>
          <CardDescription>Campuses you currently have inspection access to</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assigned campuses...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 py-6">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : schools.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">
              No campuses assigned yet. Contact your administrator to be assigned to a campus.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {schools.map((school) => (
                <li key={school.id} className="py-3 flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{school.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-[#022172]" />
            Visit scheduling, observations, reports & more
          </CardTitle>
          <CardDescription>Coming soon in the next phases of the Inspection module</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
