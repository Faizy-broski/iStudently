'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getSchoolSettings, updateSchoolSettings, sendTestDiaryReminder } from '@/lib/api/school-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Bell, Save, Send, Loader2, Mail, Clock, CalendarDays, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

const getDayLabels = (t: any) => [
  { value: 0, label: t('days.monday') },
  { value: 1, label: t('days.tuesday') },
  { value: 2, label: t('days.wednesday') },
  { value: 3, label: t('days.thursday') },
  { value: 4, label: t('days.friday') },
  { value: 5, label: t('days.saturday') },
  { value: 6, label: t('days.sunday') },
]

export default function EmailRemindersPage() {
  const t = useTranslations('school.email_reminders')
  const { profile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  // Diary reminder state
  const [enabled, setEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('07:00')
  const [reminderDays, setReminderDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [testEmail, setTestEmail] = useState('')

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSchoolSettings()
      if (result.success && result.data) {
        setEnabled(result.data.diary_reminder_enabled)
        setReminderTime(result.data.diary_reminder_time)
        setReminderDays(result.data.diary_reminder_days)
      }
    } catch {
      toast.error(t('msg_load_error'))
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    const load = async () => {
      await fetchSettings()
    }
    void load()
  }, [fetchSettings])

  useEffect(() => {
    const email = profile?.email
    if (email) {
      const timer = setTimeout(() => setTestEmail(email), 0)
      return () => clearTimeout(timer)
    }
  }, [profile])

  const handleSave = async () => {
    if (reminderDays.length === 0 && enabled) {
      toast.error(t('msg_no_days'))
      return
    }

    setSaving(true)
    try {
      const result = await updateSchoolSettings({
        diary_reminder_enabled: enabled,
        diary_reminder_time: reminderTime,
        diary_reminder_days: reminderDays,
      })
      if (result.success) {
        toast.success(t('msg_save_success'))
      } else {
        toast.error(result.error || t('msg_save_error'))
      }
    } catch {
      toast.error(t('msg_save_error'))
    }
    setSaving(false)
  }

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error(t('msg_test_no_email'))
      return
    }
    setSendingTest(true)
    try {
      const result = await sendTestDiaryReminder(testEmail)
      if (result.success) {
        toast.success(t('msg_test_success', { email: testEmail }))
      } else {
        toast.error(result.error || t('msg_test_error'))
      }
    } catch {
      toast.error(t('msg_test_error'))
    }
    setSendingTest(false)
  }

  const toggleDay = (dayValue: number) => {
    setReminderDays(prev =>
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue].sort((a, b) => a - b)
    )
  }

  const selectWeekdays = () => setReminderDays([0, 1, 2, 3, 4])
  const selectAllDays = () => setReminderDays([0, 1, 2, 3, 4, 5, 6])
  const clearDays = () => setReminderDays([])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-[#57A3CC] to-[#022172]">
          <Bell className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">{t('info_title')}</p>
          <p className="mt-1">
            {t('info_desc')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Enable/Disable Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#022172]" />
              {t('card_diary_title')}
            </CardTitle>
            <CardDescription>
              {t('card_diary_subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">
                  {t('label_enable')}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t('desc_enable')}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className={!enabled ? 'opacity-50 pointer-events-none' : ''}>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('label_time')}
                </Label>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-40"
                />
                <p className="text-xs text-muted-foreground">
                  {t('hint_time')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Days Selection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#022172]" />
              {t('card_days_title')}
            </CardTitle>
            <CardDescription>
              {t('card_days_subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className={!enabled ? 'opacity-50 pointer-events-none' : ''}>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectWeekdays}
                  className="text-xs"
                >
                  {t('btn_weekdays')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllDays}
                  className="text-xs"
                >
                  {t('btn_all_days')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearDays}
                  className="text-xs"
                >
                  {t('btn_clear')}
                </Button>
              </div>

              <div className="space-y-3">
                {getDayLabels(t).map((day) => (
                  <div key={day.value} className="flex items-center gap-3">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={reminderDays.includes(day.value)}
                      onCheckedChange={() => toggleDay(day.value)}
                    />
                    <Label
                      htmlFor={`day-${day.value}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {t('hint_days')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Email Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-[#022172]" />
              {t('card_test_title')}
            </CardTitle>
            <CardDescription>
              {t('card_test_subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>{t('label_test_email')}</Label>
                <Input
                  type="email"
                  placeholder={t('placeholder_test_email')}
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail}
                variant="outline"
                className="shrink-0"
              >
                {sendingTest ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {sendingTest ? t('btn_sending') : t('btn_send_test')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-linear-to-r from-[#57A3CC] to-[#022172] text-white px-8"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? t('btn_saving') : t('btn_save')}
        </Button>
      </div>
    </div>
  )
}
