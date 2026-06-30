'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Gauge, BookOpen, Users, TrendingUp, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getAuthToken } from '@/lib/api/schools'
import { getDashboardStats, getLeaderboard, getBadge, type DashboardStats, type LeaderboardEntry } from '@/lib/api/speed-reading'
import { useAuth } from '@/context/AuthContext'

export default function SpeedReadingAdminPage() {
  const t = useTranslations('speedReading')
  const { profile } = useAuth()
  // Reading texts are school-wide — always use the root school_id
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.school_id) return
    const load = async () => {
      setLoading(true)
      const token = await getAuthToken()
      const [statsRes, lbRes] = await Promise.all([
        getDashboardStats(token, profile.school_id),
        getLeaderboard(token, profile.school_id),
      ])
      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      if (lbRes.success && lbRes.data) setLeaderboard(lbRes.data)
      setLoading(false)
    }
    load()
  }, [profile?.school_id])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b pb-4">
        <Gauge className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-blue-500" />}
          label={t('totalTexts')}
          value={loading ? null : stats?.total_texts ?? 0}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-green-500" />}
          label={t('totalSessions')}
          value={loading ? null : stats?.total_sessions ?? 0}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
          label={t('topWpmWeek')}
          value={loading ? null : stats?.top_wpm_this_week ?? 0}
        />
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {t('leaderboard')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">{t('noSessions')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left rtl:text-right py-2 px-3 w-12">{t('rank')}</th>
                    <th className="text-left rtl:text-right py-2 px-3">{t('name')}</th>
                    <th className="text-left rtl:text-right py-2 px-3">{t('totalPoints')}</th>
                    <th className="text-left rtl:text-right py-2 px-3">{t('bestWpm')}</th>
                    <th className="text-left rtl:text-right py-2 px-3">{t('sessions')}</th>
                    <th className="text-left rtl:text-right py-2 px-3">{t('badge')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, idx) => {
                    const { emoji, label } = getBadge(entry.best_wpm)
                    return (
                      <tr key={entry.student_id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 px-3 font-bold text-muted-foreground">#{idx + 1}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={entry.profile_photo_url ?? ''} />
                              <AvatarFallback>{entry.first_name[0]}{entry.last_name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{entry.first_name} {entry.last_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-primary">{entry.total_points}</td>
                        <td className="py-3 px-3">{entry.best_wpm} WPM</td>
                        <td className="py-3 px-3">{entry.sessions}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline">{emoji} {label}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | null }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {value === null ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
