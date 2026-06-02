'use client'

import { useState, useEffect } from 'react'
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
  const [config, setConfig] = useState<VlabySchoolConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getVlabySchoolConfig().then(res => {
      if (res.success && res.data) setConfig(res.data)
      setLoading(false)
    })
  }, [])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await connectVlabySchool(email, password)
    setSubmitting(false)
    if (!res.success || !res.data) {
      toast.error(res.error || 'Failed to connect VLaby account')
      return
    }
    setConfig(res.data)
    setShowForm(false)
    setEmail('')
    setPassword('')
    toast.success('VLaby school account connected')
  }

  const handleDisconnect = async () => {
    setSubmitting(true)
    const res = await disconnectVlabySchool()
    setSubmitting(false)
    if (!res.success) { toast.error(res.error || 'Failed to disconnect'); return }
    setConfig({ connected: false, email: null, connected_at: null })
    toast.success('VLaby account disconnected')
  }

  if (loading) return null

  return (
    <div className="border rounded-xl p-4 bg-gray-50/60 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <FlaskConical size={15} className="text-indigo-600" />
        School VLaby Account
      </div>

      {config?.connected ? (
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            disabled={submitting}
            onClick={handleDisconnect}
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
            Disconnect
          </Button>
        </div>
      ) : showForm ? (
        <form onSubmit={handleConnect} className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="VLaby email"
              required
              className="h-8 text-sm flex-1 min-w-[160px]"
              autoFocus
            />
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="h-8 text-sm flex-1 min-w-[140px]"
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
            <LogIn size={12} /> Connect VLaby Account
          </Button>
        </div>
      )}
    </div>
  )
}
