'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { FlaskConical, LogIn, LogOut, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  getVlabySchoolConfig,
  connectVlabySchool,
  disconnectVlabySchool,
  type VlabySchoolConfig,
} from '@/lib/api/vlaby'
import { format } from 'date-fns'

export function VLabySchoolConnect() {
  const { data: config, mutate } = useSWR<VlabySchoolConfig | null>(
    'vlaby-school-config',
    async () => {
      const res = await getVlabySchoolConfig()
      return res.success && res.data ? res.data : null
    },
    { revalidateOnFocus: false }
  )
  const loading = config === undefined
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const now = useState(() => Date.now())[0]

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await connectVlabySchool(email, password)
    setSubmitting(false)
    if (!res.success || !res.data) {
      toast.error(res.error || 'Failed to connect Virtual Labs account')
      return
    }
    mutate(res.data, false)
    setShowForm(false)
    setEmail('')
    setPassword('')
    toast.success('Virtual Labs school account connected')
  }

  const handleDisconnect = async () => {
    setSubmitting(true)
    const res = await disconnectVlabySchool()
    setSubmitting(false)
    if (!res.success) { toast.error(res.error || 'Failed to disconnect'); return }
    mutate({ connected: false, email: null, connected_at: null }, false)
    toast.success('Virtual Labs account disconnected')
  }

  if (loading) return null

  return (
    <div className="border rounded-xl p-4 bg-gray-50/60 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <FlaskConical size={15} className="text-indigo-600" />
        School Virtual Labs Account
      </div>

      {config?.connected && !showForm ? (
        <div className="flex flex-col gap-2">
          {config.connected_at && (() => {
            const daysAgo = Math.floor((now - new Date(config.connected_at).getTime()) / 86_400_000)
            return daysAgo >= 7 ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5">
                <AlertCircle size={12} className="shrink-0" />
                Session connected {daysAgo} days ago — if experiments fail to open, click Reconnect to refresh.
              </div>
            ) : null
          })()}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={15} className="text-green-500 shrink-0" />
              <span className="text-gray-700">
                Connected as <span className="font-medium">{config.email}</span>
                {config.connected_at && (
                  <span className="text-gray-400 ml-1">
                    · since {format(new Date(config.connected_at), 'MMM d, yyyy')}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                disabled={submitting}
                onClick={() => { setEmail(config.email ?? ''); setShowForm(true) }}
              >
                <LogIn size={12} /> Reconnect
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7 text-red-600 hover:text-red-700"
                disabled={submitting}
                onClick={handleDisconnect}
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      ) : showForm ? (
        <form onSubmit={handleConnect} className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Virtual Labs email"
              required
              className="h-8 text-sm flex-1 min-w-40"
              autoFocus
            />
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="h-8 text-sm flex-1 min-w-35"
            />
            <Button type="submit" size="sm" disabled={submitting} className="h-8 gap-1.5 text-xs">
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={12} />}
              Connect
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            Not connected — students cannot open experiments
          </div>
          <Button size="sm" className="gap-1.5 text-xs h-7" onClick={() => setShowForm(true)}>
            <LogIn size={12} /> Connect Virtual Labs Account
          </Button>
        </div>
      )}
    </div>
  )
}
