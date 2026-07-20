'use client'

import { useParams } from 'next/navigation'
import { RoomView } from '@/components/jitsi/RoomView'

export default function TeacherJitsiRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  return <RoomView roomId={roomId} />
}
