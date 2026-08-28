'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import Link from 'next/link'
import { MessageCircle, Plus, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  listMyThreads, listMyWardsForThreads, listMyStudentsForThreads, listContactsForStudent, getOrCreateThread,
  type FinaThread,
} from '@/lib/api/fina-threads'

/**
 * "Start a new conversation" works from either side: a guardian picks a
 * child then one of that child's teachers, or a teacher picks a student
 * they teach then one of that student's guardians. Same two-step picker UI,
 * just swapping which list backs each step and which id getOrCreateThread
 * receives (teacher_profile_id vs guardian_profile_id) — the backend's
 * getOrCreateThread already accepted either direction, this was previously
 * just a guardian-only UI (a disclosed scope trim, not a backend gap).
 */
export function ThreadList({ role, basePath }: { role: 'parent' | 'teacher' | 'admin'; basePath: string }) {
  const t = useTranslations('fina.threads')
  const [threads, setThreads] = useState<FinaThread[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [wards, setWards] = useState<{ id: string; name: string }[]>([])
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])
  const [starting, setStarting] = useState(false)

  const load = useCallback(() => { listMyThreads().then((res) => setThreads(res.data ?? [])) }, [])
  useEffect(() => { load() }, [load])

  const openPicker = async () => {
    setPickerOpen(true)
    setSelectedWardId(null)
    setContacts([])
    const res = role === 'teacher' ? await listMyStudentsForThreads() : await listMyWardsForThreads()
    setWards(res.data ?? [])
  }

  const selectWard = async (wardId: string) => {
    setSelectedWardId(wardId)
    const res = await listContactsForStudent(wardId)
    setContacts(res.data ?? [])
  }

  const startWith = async (contactId: string) => {
    if (!selectedWardId) return
    setStarting(true)
    try {
      const res = role === 'teacher'
        ? await getOrCreateThread({ guardian_profile_id: contactId, student_id: selectedWardId })
        : await getOrCreateThread({ teacher_profile_id: contactId, student_id: selectedWardId })
      if (res.error || !res.data) toast.error(res.error || 'Failed')
      else { setPickerOpen(false); load() }
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('page_title')}</h1>
        {(role === 'parent' || role === 'teacher') && (
          <Button size="sm" onClick={openPicker} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t('new_button')}
          </Button>
        )}
      </div>

      {threads === null ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-400">{t('loading')}</CardContent></Card>
      ) : threads.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500 flex flex-col items-center gap-2"><MessageCircle className="h-6 w-6 text-gray-300" />{t('empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {threads.map((th) => {
            const counterpart = role === 'teacher' ? th.guardian : th.teacher
            const name = [counterpart?.first_name, counterpart?.last_name].filter(Boolean).join(' ') || '—'
            const studentName = [th.student?.profile?.first_name, th.student?.profile?.last_name].filter(Boolean).join(' ')
            return (
              <Link key={th.id} href={`${basePath}/${th.id}`}>
                <Card className="hover:bg-gray-50">
                  <CardContent className="py-3">
                    <div className="text-sm font-medium text-gray-800">{name}</div>
                    <div className="text-xs text-gray-400">{studentName}</div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('new_button')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <p className="text-xs text-gray-500 mb-1.5">{role === 'teacher' ? t('pick_student') : t('pick_child')}</p>
              <div className="flex flex-wrap gap-1.5">
                {wards.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => selectWard(w.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${selectedWardId === w.id ? 'bg-[#022172] text-white border-[#022172]' : 'border-gray-200 text-gray-600'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
            {selectedWardId && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{role === 'teacher' ? t('pick_guardian') : t('pick_teacher')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {contacts.map((c) => (
                    <button key={c.id} onClick={() => startWith(c.id)} disabled={starting} className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50">
                      {starting ? <Loader2 className="h-3 w-3 animate-spin inline" /> : c.name}
                    </button>
                  ))}
                  {contacts.length === 0 && <p className="text-xs text-gray-400">{role === 'teacher' ? t('no_guardians') : t('no_teachers')}</p>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>{t('cancel_button')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
