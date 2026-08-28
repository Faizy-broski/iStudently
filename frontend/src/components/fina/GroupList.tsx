'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Users, Plus, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { listGroups, createGroup, joinGroup, leaveGroup, type FinaGroup } from '@/lib/api/fina-groups'

export function GroupList({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations('fina.groups')
  const [groups, setGroups] = useState<FinaGroup[] | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => { listGroups().then((res) => setGroups(res.data ?? [])) }, [])
  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await createGroup({ name: newName.trim() })
      if (res.error) toast.error(res.error)
      else { setNewName(''); load() }
    } finally {
      setCreating(false)
    }
  }

  const handleToggleMembership = async (group: FinaGroup) => {
    setBusyId(group.id)
    try {
      const res = group.isMember ? await leaveGroup(group.id) : await joinGroup(group.id)
      if (res.error) toast.error(res.error)
      else load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('page_title')}</h1>

      {canCreate && (
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('name_placeholder')} />
          <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="gap-1.5 shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {groups === null ? (
        <Skeleton className="h-16 w-full" />
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800">{g.name}</span>
                </div>
                <Button
                  size="sm"
                  variant={g.isMember ? 'outline' : 'default'}
                  onClick={() => handleToggleMembership(g)}
                  disabled={busyId === g.id}
                >
                  {t(g.isMember ? 'leave_button' : 'join_button')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
