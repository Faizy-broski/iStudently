'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Gauge, BookOpen, Trophy, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getAuthToken } from '@/lib/api/schools'
import {
  getTexts, getLeaderboard, getMyStats,
  getBadge,
  type ReadingText, type LeaderboardEntry, type StudentStats,
} from '@/lib/api/speed-reading'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

export default function StudentSpeedReadingPage() {
  const t = useTranslations('speedReading')
  const router = useRouter()
  const { profile } = useAuth()
  useCampus()
  const schoolId = profile?.school_id

  const [texts, setTexts] = useState<ReadingText[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myStats, setMyStats] = useState<StudentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!schoolId) return
    const load = async () => {
      setLoading(true)
      const token = await getAuthToken()
      const [textsRes, lbRes, statsRes] = await Promise.all([
        getTexts(token, schoolId),
        getLeaderboard(token, schoolId),
        getMyStats(token),
      ])
      if (textsRes.success && textsRes.data) setTexts(textsRes.data)
      if (lbRes.success && lbRes.data) setLeaderboard(lbRes.data)
      if (statsRes.success && statsRes.data) setMyStats(statsRes.data)
      setLoading(false)
    }
    load()
  }, [schoolId])

  const myBadge = myStats ? getBadge(myStats.best_wpm) : getBadge(0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b pb-4">
        <Gauge className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {/* My Stats */}
      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <div className="flex gap-6">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-24" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 items-center">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{myStats?.total_points ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('totalPoints')}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{myStats?.best_wpm ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('bestWpm')}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{myStats?.sessions ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('totalSessions')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl">{myBadge.emoji}</p>
                <p className="text-xs text-muted-foreground mt-1">{myBadge.label}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Texts */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          Available Texts
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : texts.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">{t('noTexts')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {texts.map(text => (
              <Card key={text.id} className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/student/speed-reading/${text.id}/read`)}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{text.title}</h3>
                    <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                      <Globe className="h-3 w-3" />
                      {text.language === 'ar' ? t('languageAr') : t('languageEn')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{text.word_count} words</p>
                  {text.quiz_questions && text.quiz_questions.length > 0 && (
                    <Badge className="text-xs">+ Comprehension Quiz</Badge>
                  )}
                  <Button size="sm" className="w-full mt-1">
                    {t('startReading')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
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
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">{t('noSessions')}</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, idx) => {
                const { emoji } = getBadge(entry.best_wpm)
                const isMe = entry.student_id === profile?.id
                return (
                  <div key={entry.student_id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${isMe ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/30'}`}>
                    <span className="text-sm font-bold text-muted-foreground w-6 text-center">#{idx + 1}</span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={entry.profile_photo_url ?? ''} />
                      <AvatarFallback>{entry.first_name[0]}{entry.last_name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-medium">{entry.first_name} {entry.last_name}</span>
                    <span className="text-sm text-muted-foreground">{entry.best_wpm} WPM</span>
                    <span className="text-sm font-semibold text-primary">{entry.total_points} pts</span>
                    <span className="text-base">{emoji}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
