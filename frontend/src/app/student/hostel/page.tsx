'use client'

import useSWR from 'swr'
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, BedDouble, Building2, Users, AlertCircle, CheckCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'

async function fetchHostelAssignment() {
  const token = await getAuthToken()
  const res = await fetch(`${API_URL}/student-dashboard/hostel`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Failed to fetch hostel assignment')
  return json.data
}

export default function StudentHostelPage() {
  const { data: assignment, isLoading, error } = useSWR(
    'student-hostel',
    fetchHostelAssignment,
    { revalidateOnFocus: false }
  )

  const room = assignment?.room
  const building = room?.building

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hostel</h1>
        <p className="text-muted-foreground mt-1">Your hostel room assignment details</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Failed to load hostel information</p>
          </CardContent>
        </Card>
      ) : !assignment ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BedDouble className="h-14 w-14 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-semibold">No Hostel Assignment</p>
            <p className="text-muted-foreground mt-1">You are not currently assigned to a hostel room</p>
            <p className="text-sm text-muted-foreground mt-1">Contact your school administration if you need hostel accommodation</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Room Card */}
          <Card className="border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <BedDouble className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">Room {room?.room_number || '—'}</h2>
                    <Badge variant="outline" className="border-green-400 text-green-600 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Assigned
                    </Badge>
                  </div>
                  {room?.room_type && (
                    <p className="text-sm text-muted-foreground capitalize">{room.room_type.replace(/_/g, ' ')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {building?.name && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Building2 className="h-4 w-4 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Building</p>
                    <p className="font-semibold text-sm">{building.name}</p>
                  </div>
                )}
                {room?.floor && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <BedDouble className="h-4 w-4 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Floor</p>
                    <p className="font-semibold text-sm">{room.floor}</p>
                  </div>
                )}
                {room?.capacity && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Users className="h-4 w-4 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Capacity</p>
                    <p className="font-semibold text-sm">{room.capacity} person{room.capacity !== 1 ? 's' : ''}</p>
                  </div>
                )}
                {building?.gender && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <Users className="h-4 w-4 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Block Type</p>
                    <p className="font-semibold text-sm capitalize">{building.gender}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assignment Details */}
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-3">Assignment Details</h3>
              <div className="space-y-2 text-sm">
                {assignment.check_in_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-in Date</span>
                    <span className="font-medium">{format(parseISO(assignment.check_in_date), 'MMMM d, yyyy')}</span>
                  </div>
                )}
                {assignment.check_out_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-out Date</span>
                    <span className="font-medium">{format(parseISO(assignment.check_out_date), 'MMMM d, yyyy')}</span>
                  </div>
                )}
                {assignment.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground text-xs mb-1">Notes</p>
                    <p>{assignment.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
