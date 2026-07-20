'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { listMyRooms, createRoom, updateRoom, deleteRoom, type JitsiRoom } from '@/lib/api/jitsi'
import { RoomCard } from '@/components/jitsi/RoomCard'
import { RoomForm } from '@/components/jitsi/RoomForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

interface MyRoomsManagerProps {
  /** e.g. '/teacher/jitsi-meet' or '/admin/jitsi-meet' — used to build the room join link */
  basePath: string
}

export function MyRoomsManager({ basePath }: MyRoomsManagerProps) {
  const t = useTranslations('live_class')
  const { profile } = useAuth()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id ?? null
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<JitsiRoom | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: roomsRes, isLoading, mutate } = useSWR(
    profile ? ['jitsi-my-rooms', profile.id] : null,
    () => listMyRooms(),
    { revalidateOnFocus: false }
  )

  const rooms = roomsRes?.data || []

  const handleCreate = async (data: Parameters<typeof createRoom>[0]) => {
    setSaving(true)
    const res = await createRoom({ ...data, campus_id: campusId })
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(t('toast_room_created'))
    setShowCreate(false)
    mutate()
  }

  const handleUpdate = async (data: Parameters<typeof updateRoom>[1]) => {
    if (!editing) return
    setSaving(true)
    const res = await updateRoom(editing.id, data)
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(t('toast_room_updated'))
    setEditing(null)
    mutate()
  }

  const handleDelete = async (room: JitsiRoom) => {
    if (!confirm(t('confirm_delete_room'))) return
    const res = await deleteRoom(room.id)
    if (res.error) { toast.error(res.error); return }
    toast.success(t('toast_room_deleted'))
    mutate()
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('my_rooms')}</h1>
        {!showCreate && !editing && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('new_room')}
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('new_room')}</CardTitle></CardHeader>
          <CardContent>
            <RoomForm submitting={saving} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('edit_room')}</CardTitle></CardHeader>
          <CardContent>
            <RoomForm initial={editing} submitting={saving} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {!isLoading && rooms.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground">{t('no_rooms_yet')}</p>
      )}

      <div className="space-y-3">
        {rooms.map((r) => (
          <RoomCard
            key={r.id}
            room={r}
            href={`${basePath}/rooms/${r.id}`}
            onEdit={() => setEditing(r)}
            onDelete={() => handleDelete(r)}
          />
        ))}
      </div>
    </div>
  )
}
