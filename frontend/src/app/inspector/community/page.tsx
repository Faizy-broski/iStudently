'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Megaphone, MessageSquare, Plus, Pin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog'
import { getMyAssignedSchools } from '@/lib/api/inspectors'
import {
  createBroadcast, listBroadcastsForSchool, createThread, listThreadsForSchool,
  type InspectorBroadcast, type ForumThread,
} from '@/lib/api/inspector-community'

export default function InspectorCommunityPage() {
  const t = useTranslations('inspections.community')
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null)
  const [loadingSchools, setLoadingSchools] = useState(true)

  const [broadcasts, setBroadcasts] = useState<InspectorBroadcast[]>([])
  const [threads, setThreads] = useState<ForumThread[]>([])
  const [loadingFeed, setLoadingFeed] = useState(false)

  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastTargets, setBroadcastTargets] = useState<string[]>([])
  const [savingBroadcast, setSavingBroadcast] = useState(false)

  const [threadOpen, setThreadOpen] = useState(false)
  const [threadTitle, setThreadTitle] = useState('')
  const [threadBody, setThreadBody] = useState('')
  const [threadTargets, setThreadTargets] = useState<string[]>([])
  const [savingThread, setSavingThread] = useState(false)

  useEffect(() => {
    getMyAssignedSchools().then((res) => {
      const list = res.data || []
      setSchools(list)
      if (list.length > 0) setSelectedSchoolId(list[0].id)
      setLoadingSchools(false)
    })
  }, [])

  const loadFeed = useCallback(() => {
    if (!selectedSchoolId) return
    setLoadingFeed(true)
    Promise.all([listBroadcastsForSchool(selectedSchoolId), listThreadsForSchool(selectedSchoolId)]).then(([bRes, tRes]) => {
      setBroadcasts(bRes.data || [])
      setThreads(tRes.data || [])
      setLoadingFeed(false)
    })
  }, [selectedSchoolId])

  useEffect(() => { loadFeed() }, [loadFeed])

  const toggleTarget = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  const handleCreateBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim() || broadcastTargets.length === 0) return
    setSavingBroadcast(true)
    try {
      const res = await createBroadcast({ title: broadcastTitle.trim(), body: broadcastBody.trim(), target_school_ids: broadcastTargets })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('msg_broadcast_sent'))
        setBroadcastOpen(false)
        setBroadcastTitle(''); setBroadcastBody(''); setBroadcastTargets([])
        loadFeed()
      }
    } finally {
      setSavingBroadcast(false)
    }
  }

  const handleCreateThread = async () => {
    if (!threadTitle.trim() || !threadBody.trim() || threadTargets.length === 0) return
    setSavingThread(true)
    try {
      const res = await createThread({ title: threadTitle.trim(), body: threadBody.trim(), target_school_ids: threadTargets })
      if (res.error) toast.error(res.error)
      else {
        toast.success(t('msg_thread_created'))
        setThreadOpen(false)
        setThreadTitle(''); setThreadBody(''); setThreadTargets([])
        loadFeed()
      }
    } finally {
      setSavingThread(false)
    }
  }

  if (loadingSchools) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('inspector_subtitle')}</p>
      </div>

      {schools.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('no_assigned_campuses')}</CardContent></Card>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {schools.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSchoolId(s.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedSchoolId === s.id ? 'bg-[#022172] text-white border-[#022172]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[#022172]" />
                {t('broadcasts_title')}
              </CardTitle>
              <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    {t('btn_new_broadcast')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('dialog_new_broadcast')}</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label>{t('field_title')}</Label>
                      <Input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('field_body')}</Label>
                      <Textarea rows={4} value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('field_target_campuses')}</Label>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {schools.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`bc-${s.id}`}
                              checked={broadcastTargets.includes(s.id)}
                              onCheckedChange={() => toggleTarget(broadcastTargets, setBroadcastTargets, s.id)}
                            />
                            <Label htmlFor={`bc-${s.id}`} className="text-sm font-normal cursor-pointer">{s.name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateBroadcast} disabled={savingBroadcast || !broadcastTitle.trim() || !broadcastBody.trim() || broadcastTargets.length === 0} className="gap-2">
                      {savingBroadcast ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {t('btn_send')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingFeed ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : broadcasts.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">{t('no_broadcasts')}</p>
              ) : (
                <div className="space-y-2">
                  {broadcasts.map((b) => (
                    <div key={b.id} className="p-2.5 rounded-md border">
                      <div className="text-sm font-medium text-gray-900">{b.title}</div>
                      <p className="text-xs text-gray-600 mt-0.5">{b.body}</p>
                      <div className="text-[11px] text-gray-400 mt-1">{new Date(b.created_at).toLocaleString()}</div>
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
                    <div className="space-y-1.5">
                      <Label>{t('field_target_campuses')}</Label>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {schools.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`th-${s.id}`}
                              checked={threadTargets.includes(s.id)}
                              onCheckedChange={() => toggleTarget(threadTargets, setThreadTargets, s.id)}
                            />
                            <Label htmlFor={`th-${s.id}`} className="text-sm font-normal cursor-pointer">{s.name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateThread} disabled={savingThread || !threadTitle.trim() || !threadBody.trim() || threadTargets.length === 0} className="gap-2">
                      {savingThread ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {t('btn_create')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {loadingFeed ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : threads.length === 0 ? (
                <p className="text-sm text-gray-500 py-2 px-4">{t('no_threads')}</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {threads.map((th) => (
                    <Link key={th.id} href={`/inspector/community/${th.id}`} className="flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors">
                      {th.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      <span className="text-sm text-gray-800 truncate">{th.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
