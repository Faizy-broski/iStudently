'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  FlaskConical,
  ExternalLink,
  X,
  Clock,
  Send,
  ChevronRight,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { getStudentLabs, submitFindings, type PhysicsLab } from '@/lib/api/physics-labs'
import { PHYSICS_CATALOG, type SimulationMeta, type SimCategory } from '@/lib/physics-labs-catalog'

const CATEGORY_COLORS: Record<SimCategory, string> = {
  'Pendulums':       'bg-blue-100 text-blue-800',
  'Springs':         'bg-green-100 text-green-800',
  'Collisions':      'bg-red-100 text-red-800',
  'Roller Coasters': 'bg-orange-100 text-orange-800',
  'Orbital':         'bg-purple-100 text-purple-800',
  'Waves':           'bg-cyan-100 text-cyan-800',
  'Other':           'bg-gray-100 text-gray-700',
}

function getCatalogEntry(simKey: string): SimulationMeta | undefined {
  return PHYSICS_CATALOG.find(s => s.key === simKey)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function StudentPhysicsLabsPage() {
  const t  = useTranslations('physicsLabs.student')
  const tP = useTranslations('physicsLabs')
  const { profile } = useAuth()

  const [labs, setLabs] = useState<PhysicsLab[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Active simulation panel
  const [activeLab, setActiveLab] = useState<PhysicsLab | null>(null)
  const [iframeError, setIframeError] = useState(false)

  // Time tracker
  const [timeSpent, setTimeSpent] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Findings submission
  const [findings, setFindings] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      setLoading(true)
      const res = await getStudentLabs({ grade_id: (profile as any).grade_id || undefined })
      if (res.success && res.data) setLabs(res.data)
      setLoading(false)
    }
    load()
  }, [profile])

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  function openLab(lab: PhysicsLab) {
    setActiveLab(lab)
    setIframeError(false)
    setFindings('')
    setSubmitted(false)
    setTimeSpent(0)
    startTimer()
  }

  function closeLab() {
    stopTimer()
    setActiveLab(null)
  }

  useEffect(() => () => stopTimer(), [stopTimer])

  async function handleSubmitFindings() {
    if (!activeLab || !findings.trim()) return
    stopTimer()
    setSubmitting(true)
    const res = await submitFindings({
      lab_id:        activeLab.id,
      findings_text: findings.trim(),
      time_spent_s:  timeSpent,
    })
    setSubmitting(false)
    if (!res.success) {
      toast.error(res.error || 'Failed to submit findings')
      startTimer()
      return
    }
    toast.success(t('submitted'))
    setSubmitted(true)
  }

  const filteredLabs = labs.filter(lab => {
    if (!search) return true
    const sim = getCatalogEntry(lab.sim_key)
    const title = sim?.title || lab.sim_key
    return title.toLowerCase().includes(search.toLowerCase())
  })

  const activeSim = activeLab ? getCatalogEntry(activeLab.sim_key) : null

  return (
    <div className="flex flex-col lg:flex-row h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* ── Left: Lab List ── */}
      <div className={`${activeLab ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 xl:w-96 border-r bg-gray-50 shrink-0`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-white">
          <FlaskConical className="h-5 w-5 text-[#022172]" />
          <span className="font-semibold text-sm">{t('title')}</span>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {tP('loading')}
            </p>
          ) : filteredLabs.length === 0 ? (
            <div className="text-center py-10 px-4">
              <FlaskConical className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {labs.length === 0 ? t('noLabsAssigned') : t('noLabsSearch')}
              </p>
            </div>
          ) : (
            filteredLabs.map(lab => {
              const sim = getCatalogEntry(lab.sim_key)
              const isActive = activeLab?.id === lab.id
              return (
                <button
                  key={lab.id}
                  onClick={() => openLab(lab)}
                  className={`w-full text-left rounded-lg p-3 mb-1 transition-colors flex items-start gap-2 ${
                    isActive
                      ? 'bg-[#022172] text-white'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                >
                  <FlaskConical className={`h-4 w-4 mt-0.5 shrink-0 ${isActive ? 'text-white/80' : 'text-[#022172]'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{sim?.title || lab.sim_key}</span>
                    {sim && (
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full mt-0.5 ${
                        isActive ? 'bg-white/20 text-white' : CATEGORY_COLORS[sim.category]
                      }`}>
                        {sim.category}
                      </span>
                    )}
                    {lab.custom_note && (
                      <p className={`text-xs mt-0.5 line-clamp-1 ${isActive ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {lab.custom_note}
                      </p>
                    )}
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 ${isActive ? 'text-white/60' : 'text-muted-foreground'}`} />
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right: Simulation Panel ── */}
      {activeLab ? (
        <div className="flex flex-col flex-1 min-w-0">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={closeLab} className="lg:hidden mr-1">
                <X className="h-4 w-4" />
              </button>
              <FlaskConical className="h-4 w-4 text-[#022172] shrink-0" />
              <span className="font-semibold text-sm truncate">
                {activeSim?.title || activeLab.sim_key}
              </span>
              {activeSim && (
                <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[activeSim.category]}`}>
                  {activeSim.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(timeSpent)}
              </span>
              <Button size="sm" variant="ghost" asChild>
                <a href={activeSim?.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <button onClick={closeLab} className="hidden lg:block">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Teacher instructions */}
          {activeLab.custom_note && (
            <div className="px-4 py-2 bg-blue-50 border-b text-sm text-blue-800 shrink-0">
              <span className="font-medium">{t('instructionsLabel')}</span>
              {activeLab.custom_note}
            </div>
          )}

          {/* Simulation iframe */}
          {/* overflow:hidden clips the myphysicslab.com header (top 42px) and footer copyright (bottom 48px) */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: '400px' }}>
            {iframeError ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                <FlaskConical className="h-12 w-12 text-[#022172]" />
                <div>
                  <p className="font-semibold text-gray-700 mb-1">{t('iframeErrorTitle')}</p>
                  <p className="text-sm text-gray-500 mb-4">{t('iframeErrorDesc')}</p>
                  <Button asChild variant="outline" size="sm">
                    <a href={activeSim?.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      {t('openSimulation')}
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <iframe
                key={activeLab.id}
                src={activeSim?.url}
                title={activeSim?.title || activeLab.sim_key}
                className="w-full border-none absolute inset-0"
                style={{ height: 'calc(100% + 42px + 48px)', marginTop: '-42px' }}
                sandbox="allow-scripts allow-same-origin"
                allow="fullscreen"
                onError={() => setIframeError(true)}
              />
            )}
          </div>

          {/* Findings submission */}
          <div className="border-t bg-white px-4 py-3 shrink-0">
            {submitted ? (
              <p className="text-sm text-green-700 font-medium py-1 text-center">{t('submitted')}</p>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('findingsLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('findingsDesc')}</p>
                <div className="flex gap-2">
                  <Textarea
                    placeholder={t('findingsPlaceholder')}
                    value={findings}
                    onChange={e => setFindings(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <Button
                    size="sm"
                    className="shrink-0 self-end"
                    disabled={!findings.trim() || submitting}
                    onClick={handleSubmitFindings}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {submitting ? t('submitting') : t('submit')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-col flex-1 items-center justify-center text-center p-12">
          <FlaskConical className="h-16 w-16 text-[#022172]/20 mb-4" />
          <h2 className="text-lg font-semibold text-gray-700">{t('selectTitle')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('selectDesc')}</p>
        </div>
      )}
    </div>
  )
}
