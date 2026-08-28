'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { listMessages, sendMessage, type FinaMessage } from '@/lib/api/fina-threads'
import { useAuth } from '@/context/AuthContext'

/** One conversation — spec §21's archived banner shown permanently at the
 * top, since every thread in this module IS archived/admin-visible by
 * design (see threads.service.ts's header), not a togglable state. */
export function ThreadView({ threadId, backHref, canSend }: { threadId: string; backHref: string; canSend: boolean }) {
  const t = useTranslations('fina.threads')
  const router = useRouter()
  const { profile } = useAuth()
  const [messages, setMessages] = useState<FinaMessage[] | null>(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = () => listMessages(threadId).then((res) => setMessages(res.data ?? []))
  useEffect(() => { load() }, [threadId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      const res = await sendMessage(threadId, body.trim())
      if (res.error) toast.error(res.error)
      else { setBody(''); load() }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl flex flex-col h-[80vh]">
      <button onClick={() => router.push(backHref)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </button>

      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mb-3">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        {t('archived_banner')}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pb-3">
        {messages === null ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === profile?.id
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isMine ? 'bg-[#022172] text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.body}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canSend && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('write_placeholder')}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !body.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
