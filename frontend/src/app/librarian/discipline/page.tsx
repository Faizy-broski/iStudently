'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'
import { format, parseISO } from 'date-fns'

export default function LibrarianDisciplinePage() {
  const { profile } = useAuth()
  const [referrals, setReferrals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const token = await getAuthToken()
        const params = new URLSearchParams()
        if (profile?.school_id) params.set('school_id', profile.school_id)
        params.set('limit', '50')
        const res = await fetch(`${API_URL}/discipline/referrals?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        setReferrals(data.data || [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    if (profile?.school_id) fetchReferrals()
    else setLoading(false)
  }, [profile?.school_id])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-6 w-6 text-[#022172]" />
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">Discipline Records</h1>
          <p className="text-muted-foreground text-sm">View student discipline referrals</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="text-lg font-semibold">No Referrals</p>
            <p className="text-muted-foreground mt-1">No discipline referrals on record.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{referrals.length} referral{referrals.length !== 1 ? 's' : ''}</p>
          {referrals.map((ref: any) => (
            <Card key={ref.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {ref.student?.first_name} {ref.student?.last_name}
                  </CardTitle>
                  <Badge variant={ref.status === 'resolved' ? 'secondary' : 'destructive'}>
                    {ref.status || 'open'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 text-sm">
                {ref.infraction_type && (
                  <p><span className="text-muted-foreground">Type:</span> {ref.infraction_type}</p>
                )}
                {ref.description && (
                  <p><span className="text-muted-foreground">Description:</span> {ref.description}</p>
                )}
                {ref.created_at && (
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(ref.created_at), 'MMM d, yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
