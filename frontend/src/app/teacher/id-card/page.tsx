'use client'

import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserQRCode } from '@/components/shared/UserQRCode'

export default function TeacherIdCardPage() {
  const { profile } = useAuth()

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Teacher'
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'T'

  return (
    <div className="p-6 space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-[#022172]" />
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">My ID Card</h1>
          <p className="text-muted-foreground text-sm">Your digital identification card</p>
        </div>
      </div>

      <Card className="overflow-hidden shadow-xl">
        <div className="bg-gradient-to-br from-[#022172] to-[#57A3CC] p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold opacity-80 uppercase tracking-widest">Staff Identity Card</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-xl font-bold">{fullName}</p>
              <p className="text-sm opacity-80 capitalize">{profile?.role}</p>
              <p className="text-xs opacity-60 mt-1">{profile?.email}</p>
            </div>
          </div>
        </div>
        <CardContent className="p-6 flex flex-col items-center gap-4 bg-white dark:bg-gray-900">
          {profile?.id && (
            <UserQRCode value={profile.id} label={`${fullName} · ${profile?.role}`} size={120} />
          )}
          <p className="text-xs text-muted-foreground text-center">
            Scan QR to verify identity
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print ID Card
        </Button>
      </div>
    </div>
  )
}
