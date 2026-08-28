'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CalendarDays, Plus, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { listEvents, createEvent, rsvpEvent, type FinaEvent } from '@/lib/api/fina-events'

const RSVP_OPTIONS: Array<'yes' | 'no' | 'maybe'> = ['yes', 'no', 'maybe']

export function EventList({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations('fina.events')
  const [events, setEvents] = useState<FinaEvent[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [location, setLocation] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => { listEvents().then((res) => setEvents(res.data ?? [])) }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!title.trim() || !startsAt) return
    setCreating(true)
    try {
      const res = await createEvent({ title: title.trim(), starts_at: startsAt, location: location.trim() || undefined, audience_type: 'school' })
      if (res.error) {
        toast.error(res.error)
      } else {
        setTitle(''); setStartsAt(''); setLocation(''); setCreateOpen(false); load()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleRsvp = async (eventId: string, answer: 'yes' | 'no' | 'maybe') => {
    setBusyId(eventId)
    try {
      const res = await rsvpEvent(eventId, answer)
      if (res.error) toast.error(res.error)
      else load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('page_title')}</h1>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t('create_button')}
          </Button>
        )}
      </div>

      {events === null ? (
        <Skeleton className="h-20 w-full" />
      ) : events.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <CalendarDays className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{e.title}</div>
                    <div className="text-xs text-gray-400">{new Date(e.starts_at).toLocaleString()}{e.location ? ` · ${e.location}` : ''}</div>
                  </div>
                </div>
                <div className="flex gap-1.5 ps-6">
                  {RSVP_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleRsvp(e.id, opt)}
                      disabled={busyId === e.id}
                      className={`text-xs px-2.5 py-1 rounded-full border ${e.myRsvp === opt ? 'bg-[#022172] text-white border-[#022172]' : 'border-gray-200 text-gray-600'}`}
                    >
                      {t(`rsvp_${opt}`)} {e.rsvpCounts?.[opt] ? `(${e.rsvpCounts[opt]})` : ''}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('create_button')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t('field_title')}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('field_starts_at')}</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('field_location')}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating || !title.trim() || !startsAt} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('create_button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
