'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ClipboardList, Copy, Trash2, Eye, Users, BookOpen, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import { useTrainingSessions } from '@/hooks/useTraining'
import { trainingApi, TrainingSession } from '@/lib/api/training'

function capacityColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-green-500'
}

function StatusBadge({ status }: { status: TrainingSession['status'] }) {
  const map: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    full: 'bg-red-100 text-red-800',
    closed: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? ''}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function TrainingPage() {
  const router = useRouter()
  const { sessions, isLoading, mutate } = useTrainingSessions()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? ''

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${appUrl}/register/training/${token}`)
    toast.success('Registration link copied to clipboard')
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const res = await trainingApi.deleteSession(id)
    setDeletingId(null)
    if (res.success || (res as any).status === 204) {
      toast.success('Session deleted')
      mutate()
    } else {
      toast.error(res.error ?? 'Failed to delete session')
    }
  }

  // Stats
  const totalRegistrations = sessions.reduce((n, s) => n + s.registered_seats, 0)
  const open = sessions.filter((s) => s.status === 'open').length
  const full = sessions.filter((s) => s.status === 'full').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Training Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage public training courses and track registrations
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/training/create">
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length, icon: ClipboardList },
          { label: 'Open', value: open, icon: BookOpen },
          { label: 'Full', value: full, icon: CheckCircle },
          { label: 'Total Registrations', value: totalRegistrations, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 h-28" />
            </Card>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center gap-3">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-lg">No training sessions yet</p>
            <p className="text-muted-foreground text-sm">
              Create your first training session to generate a public registration link.
            </p>
            <Button asChild className="mt-2">
              <Link href="/admin/training/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Session
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const pct = session.total_seats > 0
              ? Math.round((session.registered_seats / session.total_seats) * 100)
              : 0

            return (
              <Card key={session.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Info */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">{session.title}</h3>
                        <StatusBadge status={session.status} />
                        <Badge variant="outline" className="text-xs">
                          {session.target_audience}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(session.start_date), 'MMM d, yyyy')} –{' '}
                        {format(new Date(session.end_date), 'MMM d, yyyy')}
                      </p>
                      {session.course_fee > 0 && (
                        <p className="text-sm font-medium">
                          Fee: {session.course_fee.toFixed(2)}
                        </p>
                      )}
                      {/* Capacity bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {session.registered_seats} of {session.total_seats} seats taken
                          </span>
                          <span>{session.available_seats} remaining</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${capacityColor(pct)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/training/${session.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(session.public_token)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &ldquo;{session.title}&rdquo; and all{' '}
                              {session.registered_seats} registration(s). This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => handleDelete(session.id)}
                            >
                              {deletingId === session.id ? 'Deleting…' : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
