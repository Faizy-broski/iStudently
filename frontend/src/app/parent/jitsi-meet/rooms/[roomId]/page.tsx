'use client'

import { useParams } from 'next/navigation'
import { RoomView } from '@/components/jitsi/RoomView'

export default function ParentJitsiRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  return <RoomView roomId={roomId} />
}
