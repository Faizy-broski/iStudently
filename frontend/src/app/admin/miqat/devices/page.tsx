'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, Ban, Copy, Search } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { listDevices, generateEnrolmentCode, revokeDevice, MiqatDevice } from '@/lib/api/miqat'
import { getAllTeachers, Staff } from '@/lib/api/teachers'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

export default function MiqatDevicesPage() {
  const t = useTranslations('miqat.devices')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const campusId = useCampus()?.selectedCampus?.id

  const [devices, setDevices] = useState<MiqatDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'gate' | 'teacher' | 'admin'>('gate')
  const [generating, setGenerating] = useState(false)
  const [lastCode, setLastCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [teacherQuery, setTeacherQuery] = useState('')
  const [teacherResults, setTeacherResults] = useState<Staff[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<Staff | null>(null)
  const [searchingTeachers, setSearchingTeachers] = useState(false)

  const load = async () => {
    const token = await getAuthToken()
    if (!token) return
    const res = await listDevices(token, campusId)
    if (res.success && res.data) setDevices(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [campusId])

  const handleGenerate = async () => {
    if (role === 'teacher' && !selectedTeacher) {
      toast.error(t('selectTeacherFirst'))
      return
    }
    const token = await getAuthToken()
    if (!token) return
    setGenerating(true)
    const res = await generateEnrolmentCode(role, token, role === 'teacher' ? selectedTeacher!.profile_id : undefined, campusId)
    setGenerating(false)
    if (res.success && res.data) {
      setLastCode(res.data)
      setSelectedTeacher(null)
      setTeacherQuery('')
      setTeacherResults([])
    } else {
      toast.error(res.error || t('generateError'))
    }
  }

  const handleTeacherSearch = async () => {
    if (teacherQuery.trim().length < 2) return
    setSearchingTeachers(true)
    try {
      const { data } = await getAllTeachers({ search: teacherQuery.trim(), limit: 10 })
      setTeacherResults(data)
    } catch {
      toast.error(t('searchTeachersError'))
    } finally {
      setSearchingTeachers(false)
    }
  }

  const handleRevoke = async (id: string) => {
    const token = await getAuthToken()
    if (!token) return
    const res = await revokeDevice(id, token, campusId)
    if (res.success) {
      toast.success(t('revokeSuccess'))
      load()
    } else {
      toast.error(res.error || t('revokeError'))
    }
  }

  const copyCode = () => {
    if (lastCode) {
      navigator.clipboard.writeText(lastCode.code)
      toast.success(t('codeCopied'))
    }
  }

  return (
    <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Select value={role} onValueChange={(v) => { setRole(v as typeof role); setSelectedTeacher(null) }}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gate">{t('roleGate')}</SelectItem>
                  <SelectItem value="teacher">{t('roleTeacher')}</SelectItem>
                  <SelectItem value="admin">{t('roleAdmin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating || (role === 'teacher' && !selectedTeacher)}>
              {generating ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
              {t('generateCode')}
            </Button>
          </div>

          {role === 'teacher' && (
            <div className="space-y-2">
              {selectedTeacher ? (
                <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{selectedTeacher.profile?.first_name} {selectedTeacher.profile?.last_name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTeacher(null)}>{t('change')}</Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={teacherQuery}
                      onChange={(e) => setTeacherQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTeacherSearch()}
                      placeholder={t('searchTeacherPlaceholder')}
                    />
                    <Button variant="outline" onClick={handleTeacherSearch} disabled={searchingTeachers}>
                      {searchingTeachers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {teacherResults.length > 0 && (
                    <div className="divide-y rounded-md border">
                      {teacherResults.map((tch) => (
                        <button
                          key={tch.id}
                          className="w-full text-start p-2 text-sm hover:bg-muted/50"
                          onClick={() => { setSelectedTeacher(tch); setTeacherResults([]) }}
                        >
                          {tch.profile?.first_name} {tch.profile?.last_name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {lastCode && (
            <div className="rounded-lg border bg-muted/40 p-4 flex items-center justify-between">
              <div>
                <div className="text-2xl font-mono tracking-widest">{lastCode.code}</div>
                <div className="text-xs text-muted-foreground">
                  {t('expiresAt')}: {new Date(lastCode.expires_at).toLocaleTimeString()}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colLabel')}</TableHead>
                  <TableHead>{t('colRole')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colLastSeen')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.label || d.id.slice(0, 8)}</TableCell>
                    <TableCell>{d.role}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === 'active' ? 'default' : 'destructive'}>{d.status}</Badge>
                    </TableCell>
                    <TableCell>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : t('never')}</TableCell>
                    <TableCell>
                      {d.status === 'active' && (
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(d.id)}>
                          <Ban className="h-4 w-4 me-1" />{t('revoke')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {devices.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('noDevices')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
