"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useCampus } from "@/context/CampusContext"
import { getAuthToken } from "@/lib/api/schools"
import { toast } from "sonner"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  GraduationCap,
  Calendar,
  Loader2,
  Edit,
  Save,
  X,
} from "lucide-react"
import { format } from "date-fns"

interface CampusStats {
  total_students: number
  total_teachers: number
  total_staff: number
  total_parents: number
  total_grade_levels: number
  total_sections: number
}

interface CampusFormData {
  name: string
  address: string
  phone: string
  contact_email: string
}

export default function SchoolDetailsPage() {
  const campusContext = useCampus()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<CampusStats | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<CampusFormData>({
    name: "",
    address: "",
    phone: "",
    contact_email: "",
  })

  // Get selected campus directly from context
  const selectedCampus = campusContext?.selectedCampus

  // Update form data when selected campus changes
  useEffect(() => {
    if (selectedCampus) {
      setFormData({
        name: selectedCampus.name || "",
        address: selectedCampus.address || "",
        phone: selectedCampus.phone || "",
        contact_email: selectedCampus.contact_email || "",
      })
    }
  }, [selectedCampus])

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCampus?.id) {
        setLoading(false)
        return
      }
      
      const token = await getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // Fetch campus statistics
        const statsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/setup/campuses/${selectedCampus.id}/stats`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        )
        const statsData = await statsRes.json()
        if (statsData.success) {
          setStats(statsData.data)
        }
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [selectedCampus?.id])

  const handleSave = async () => {
    if (!selectedCampus?.id) return

    const token = await getAuthToken()
    if (!token) return

    setIsSaving(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/setup/campuses/${selectedCampus.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      )
      const data = await res.json()
      
      if (res.ok) {
        toast.success("Campus updated successfully")
        setIsEditing(false)
        // Refresh campuses to get updated data
        campusContext?.refreshCampuses()
      } else {
        toast.error(data.error || "Failed to update campus")
      }
    } catch (error) {
      console.error("Error updating campus:", error)
      toast.error("Failed to update campus")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset form data to current campus values
    if (selectedCampus) {
      setFormData({
        name: selectedCampus.name || "",
        address: selectedCampus.address || "",
        phone: selectedCampus.phone || "",
        contact_email: selectedCampus.contact_email || "",
      })
    }
    setIsEditing(false)
  }

  const selectedCampusName = selectedCampus?.name || "All Campuses"

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Campus Details
          </h1>
          <p className="text-muted-foreground">
            {selectedCampus ? `Manage details for ${selectedCampusName}` : "Select a campus to view details"}
          </p>
        </div>
        {selectedCampus && !isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Campus
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {!selectedCampus ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Campus Selected</h3>
              <p className="text-muted-foreground">
                Please select a specific campus from the dropdown above to view and manage its details
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Campus Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#022172]" />
                Campus Information
              </CardTitle>
              <CardDescription>
                {isEditing ? "Edit campus details below" : `Details for ${selectedCampus.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Campus Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter campus name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter full address"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedCampus.name}</h3>
                      {selectedCampus.slug && (
                        <p className="text-sm text-muted-foreground">Code: {selectedCampus.slug}</p>
                      )}
                    </div>
                    <Badge variant={selectedCampus.status === 'active' ? "default" : "secondary"}>
                      {selectedCampus.status === 'active' ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Address</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedCampus.address || "Not provided"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedCampus.phone || "Not provided"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedCampus.contact_email || "Not provided"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(selectedCampus.created_at), "MMMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Campus Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#022172]" />
                Campus Statistics
              </CardTitle>
              <CardDescription>Overview of {selectedCampus.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <GraduationCap className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                    <p className="text-2xl font-bold text-blue-600">
                      {stats?.total_students ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <Users className="h-6 w-6 mx-auto text-green-600 mb-2" />
                    <p className="text-2xl font-bold text-green-600">
                      {stats?.total_teachers ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Teachers</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <Users className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                    <p className="text-2xl font-bold text-purple-600">
                      {stats?.total_staff ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Staff</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <Users className="h-6 w-6 mx-auto text-orange-600 mb-2" />
                    <p className="text-2xl font-bold text-orange-600">
                      {stats?.total_parents ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Parents</p>
                  </div>
                  <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
                    <GraduationCap className="h-6 w-6 mx-auto text-cyan-600 mb-2" />
                    <p className="text-2xl font-bold text-cyan-600">
                      {stats?.total_grade_levels ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Grade Levels</p>
                  </div>
                  <div className="text-center p-4 bg-pink-50 dark:bg-pink-950 rounded-lg">
                    <Users className="h-6 w-6 mx-auto text-pink-600 mb-2" />
                    <p className="text-2xl font-bold text-pink-600">
                      {stats?.total_sections ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Sections</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
