"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, User, Bell, Lock, Save, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  })
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    assignment_reminders: true,
    exam_reminders: true,
    attendance_alerts: false
  })

  useEffect(() => {
    if (profile) {
      setProfileForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || ''
      })
    }
  }, [profile])

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      // Placeholder - implement actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    setLoading(true)
    try {
      // Placeholder - implement actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Notification settings updated')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-100">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Profile Information</h2>
            <p className="text-sm text-muted-foreground">Update your personal details</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">First Name</label>
              <Input
                value={profileForm.first_name}
                onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Last Name</label>
              <Input
                value={profileForm.last_name}
                onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </label>
            <Input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              placeholder="Enter email"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </label>
            <Input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={loading}
            style={{ background: 'var(--gradient-blue)' }}
            className="text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Profile
          </Button>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-purple-100">
            <Bell className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Notification Preferences</h2>
            <p className="text-sm text-muted-foreground">Choose what notifications you want to receive</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Email Notifications</h3>
              <p className="text-sm text-muted-foreground">Receive email updates</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.email_notifications}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, email_notifications: e.target.checked })}
              className="h-5 w-5"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Assignment Reminders</h3>
              <p className="text-sm text-muted-foreground">Get reminded about assignment deadlines</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.assignment_reminders}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, assignment_reminders: e.target.checked })}
              className="h-5 w-5"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Exam Reminders</h3>
              <p className="text-sm text-muted-foreground">Get notified about upcoming exams</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.exam_reminders}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, exam_reminders: e.target.checked })}
              className="h-5 w-5"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Attendance Alerts</h3>
              <p className="text-sm text-muted-foreground">Receive alerts about attendance issues</p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.attendance_alerts}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, attendance_alerts: e.target.checked })}
              className="h-5 w-5"
            />
          </div>

          <Button
            onClick={handleSaveNotifications}
            disabled={loading}
            style={{ background: 'var(--gradient-blue)' }}
            className="text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Preferences
          </Button>
        </div>
      </Card>

      {/* Password Change */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-red-100">
            <Lock className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Change Password</h2>
            <p className="text-sm text-muted-foreground">Update your account password</p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => toast.info('Password change feature coming soon')}
        >
          Change Password
        </Button>
      </Card>

      {/* Account Info */}
      <Card className="p-6 bg-gray-50">
        <h3 className="font-semibold mb-4">Account Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">User ID:</span>
            <span className="font-medium">{profile?.id?.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium capitalize">{profile?.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Campus ID:</span>
            <span className="font-medium">{profile?.school_id?.slice(0, 8)}...</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
