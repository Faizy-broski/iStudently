'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Ban, Copy } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { listDevices, generateEnrolmentCode, revokeDevice, MiqatDevice } from '@/lib/api/miqat'
import { toast } from 'sonner'

export default function MiqatDevicesPage() {
  const t = useTranslations('miqat.devices')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const [devices, setDevices] = useState<MiqatDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'gate' | 'teacher' | 'admin'>('gate')
  const [generating, setGenerating] = useState(false)
  const [lastCode, setLastCode] = useState<{ code: string; expires_at: string } | null>(null)

  const load = async () => {
    const token = await getAuthToken()
    if (!token) return
    const res = await listDevices(token)
    if (res.success && res.data) setDevices(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    const token = await getAuthToken()
    if (!token) return
    setGenerating(true)
    const res = await generateEnrolmentCode(role, token)
    setGenerating(false)
    if (res.success && res.data) {
      setLastCode(res.data)
    } else {
      toast.error(res.error || t('generateError'))
    }
  }

  const handleRevoke = async (id: string) => {
    const token = await getAuthToken()
    if (!token) return
    const res = await revokeDevice(id, token)
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
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gate">{t('roleGate')}</SelectItem>
                  <SelectItem value="teacher">{t('roleTeacher')}</SelectItem>
                  <SelectItem value="admin">{t('roleAdmin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
              {t('generateCode')}
            </Button>
          </div>
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
