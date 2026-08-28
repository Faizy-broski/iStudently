'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Megaphone, MessageSquare, Plus, Pin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import {
  listBroadcastsForSchool, createThread, listThreadsForSchool,
  type InspectorBroadcast, type ForumThread,
} from '@/lib/api/inspector-community'

export default function TeacherCommunityPage() {
  const t = useTranslations('inspections.community')
  const { profile } = useAuth()
  const schoolId = profile?.school_id

  const [broadcasts, setBroadcasts] = useState<InspectorBroadcast[]>([])
  const [threads, setThreads] = useState<ForumThread[]>([])
  const [loading, setLoading] = useState(true)

  const [threadOpen, setThreadOpen] = useState(false)
  const [threadTitle, setThreadTitle] = useState('')
  const [threadBody, setThreadBody] = useState('')
  const [savingThread, setSavingThread] = useState(false)

  const load = useCallback(() => {
    if (!schoolId) return
    setLoading(true)
    Promise.all([listBroadcastsForSchool(schoolId), listThreadsForSchool(schoolId)]).then(([bRes, tRes]) => {
      setBroadcasts(bRes.data || [])
      setThreads(tRes.data || [])
      setLoading(false)
    })
  }, [schoolId])

  useEffect(() => { load() }, [load])

  const handleCreateThread = async () => {
    if (!threadTitle.trim() || !threadBody.trim()) return
    setSavingThread(true)
    try {
      const res = await createThread({ title: threadTitle.trim(), body: threadBody.trim() })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('msg_thread_created'))
        setThreadOpen(false)
        setThreadTitle(''); setThreadBody('')
        load()
      }
    } finally {
      setSavingThread(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('teacher_subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#022172]" />
            {t('broadcasts_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : broadcasts.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">{t('no_broadcasts')}</p>
          ) : (
            <div className="space-y-2">
              {broadcasts.map((b) => (
                <div key={b.id} className="p-2.5 rounded-md border">
                  <div className="text-sm font-medium text-gray-900">{b.title}</div>
                  <p className="text-xs text-gray-600 mt-0.5">{b.body}</p>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {b.inspector ? `${b.inspector.first_name} ${b.inspector.last_name} · ` : ''}
                    {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#022172]" />
            {t('forum_title')}
          </CardTitle>
          <Dialog open={threadOpen} onOpenChange={setThreadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t('btn_new_thread')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('dialog_new_thread')}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label>{t('field_title')}</Label>
                  <Input value={threadTitle} onChange={(e) => setThreadTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('field_body')}</Label>
                  <Textarea rows={4} value={threadBody} onChange={(e) => setThreadBody(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateThread} disabled={savingThread || !threadTitle.trim() || !threadBody.trim()} className="gap-2">
                  {savingThread ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t('btn_create')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <p className="text-sm text-gray-500 py-2 px-4">{t('no_threads')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {threads.map((th) => (
                <Link key={th.id} href={`/teacher/inspections/community/${th.id}`} className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
                  {th.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                  <span className="text-sm text-gray-800 truncate">{th.title}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
