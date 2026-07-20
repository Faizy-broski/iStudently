'use client'

import { useParams } from 'next/navigation'
import { RoomView } from '@/components/jitsi/RoomView'

export default function AdminJitsiRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  return <RoomView roomId={roomId} />
}
