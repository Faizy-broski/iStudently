'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/context/AuthContext'
import { Settings, Bell, Lock, User, Mail, Phone, MapPin, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ParentSettingsPage() {
  const { profile } = useAuth()
  const [isSaving, setIsSaving] = useState(false)

  // Notification settings
  const [notifications, setNotifications] = useState({
    attendance: true,
    grades: true,
    assignments: true,
    fees: true,
    events: true,
    announcements: false
  })

  // Profile data
  const [profileData, setProfileData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    address: ''
  })

  const handleSaveProfile = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.success('Profile updated successfully')
    setIsSaving(false)
  }

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.success('Notification preferences saved')
    setIsSaving(false)
  }

  return (
    <ParentDashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold dark:text-white">Settings</h2>
          <p className="text-gray-500 mt-1">Manage your account and preferences</p>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.profile_photo_url} />
                  <AvatarFallback className="bg-[#57A3CC] text-white text-2xl">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">Change Photo</Button>
                  <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF. Max size 2MB</p>
                </div>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    placeholder="Enter your address"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={isSaving}
                  className="bg-[#57A3CC] hover:bg-[#57A3CC]/90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-sm text-gray-600">
                Choose what notifications you want to receive about your children
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Attendance Alerts</Label>
                    <p className="text-sm text-gray-500">Get notified when your child is marked absent or late</p>
                  </div>
                  <Switch
                    checked={notifications.attendance}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, attendance: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Grade Notifications</Label>
                    <p className="text-sm text-gray-500">Receive updates when exam results are published</p>
                  </div>
                  <Switch
                    checked={notifications.grades}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, grades: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Assignment Reminders</Label>
                    <p className="text-sm text-gray-500">Reminders for upcoming assignment due dates</p>
                  </div>
                  <Switch
                    checked={notifications.assignments}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, assignments: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Fee Notifications</Label>
                    <p className="text-sm text-gray-500">Alerts for fee payments and due dates</p>
                  </div>
                  <Switch
                    checked={notifications.fees}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, fees: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Event Updates</Label>
                    <p className="text-sm text-gray-500">Notifications about school events and activities</p>
                  </div>
                  <Switch
                    checked={notifications.events}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, events: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">School Announcements</Label>
                    <p className="text-sm text-gray-500">General announcements from school administration</p>
                  </div>
                  <Switch
                    checked={notifications.announcements}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, announcements: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveNotifications}
                  disabled={isSaving}
                  className="bg-[#57A3CC] hover:bg-[#57A3CC]/90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Password</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Change your password to keep your account secure
                </p>
                <Button variant="outline">Change Password</Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Two-Factor Authentication</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Add an extra layer of security to your account
                </p>
                <Button variant="outline">Enable 2FA</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ParentDashboardLayout>
  )
}
