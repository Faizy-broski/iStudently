"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Loader2 } from "lucide-react"
import { type Parent, getParentById, updateParent } from "@/lib/api/parents"
import { toast } from "sonner"
import { CustomFieldsRenderer } from "@/components/admin/CustomFieldsRenderer"

export default function EditParentPage() {
  const params = useParams()
  const router = useRouter()
  const parentId = params.parentId as string
  
  const [parent, setParent] = useState<Parent | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editCustomFields, setEditCustomFields] = useState<Record<string, any>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch parent details
        const response = await getParentById(parentId)
        if (response.success && response.data) {
          setParent(response.data)
          setEditCustomFields(response.data.custom_fields || {})
        } else {
          toast.error(response.error || "Parent not found")
          router.push('/admin/parents/parent-info')
        }
      } catch (error) {
        console.error("Error fetching parent:", error)
        toast.error("Failed to load parent")
        router.push('/admin/parents/parent-info')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [parentId, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!parent) return

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    try {
      const updateData = {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        cnic: formData.get('cnic') as string,
        occupation: formData.get('occupation') as string,
        workplace: formData.get('workplace') as string,
        income: formData.get('income') as string,
        address: formData.get('address') as string,
        city: formData.get('city') as string,
        state: formData.get('state') as string,
        zip_code: formData.get('zipCode') as string,
        country: formData.get('country') as string,
        emergency_contact_name: formData.get('emergencyName') as string,
        emergency_contact_relation: formData.get('emergencyRelation') as string,
        emergency_contact_phone: formData.get('emergencyPhone') as string,
        notes: formData.get('notes') as string,
        custom_fields: editCustomFields,
      }

      await updateParent(parent.id, updateData)
      toast.success('Parent updated successfully!')
      router.push(`/admin/parents/${parentId}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update parent'
      toast.error(errorMessage)
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!parent) {
    return null
  }

  const parentName = `${parent.profile?.first_name || ""} ${parent.profile?.last_name || ""}`.trim() || "Parent"

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/parents/${parentId}`)}
              className="text-[#022172] hover:text-[#022172]/80"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Parent Details
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Edit Parent
          </h1>
          <p className="text-muted-foreground">
            Update information for {parentName}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#022172]">Edit Parent Information</CardTitle>
          <CardDescription>
            Update the parent&apos;s details. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Personal Information */}
            <div>
              <h4 className="font-semibold mb-3 text-sm">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    defaultValue={parent.profile?.first_name || ''}
                    placeholder="First Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    defaultValue={parent.profile?.last_name || ''}
                    placeholder="Last Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={parent.profile?.email || ''}
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={parent.profile?.phone || ''}
                    placeholder="+92 XXX XXXXXXX"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cnic">CNIC / ID Number</Label>
                  <Input
                    id="cnic"
                    name="cnic"
                    defaultValue={parent.cnic || ''}
                    placeholder="XXXXX-XXXXXXX-X"
                  />
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div>
              <h4 className="font-semibold mb-3 text-sm">Professional Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    name="occupation"
                    defaultValue={parent.occupation || ''}
                    placeholder="e.g., Teacher, Engineer"
                  />
                </div>
                <div>
                  <Label htmlFor="workplace">Workplace</Label>
                  <Input
                    id="workplace"
                    name="workplace"
                    defaultValue={parent.workplace || ''}
                    placeholder="Company/Organization name"
                  />
                </div>
                <div>
                  <Label htmlFor="income">Monthly Income</Label>
                  <Input
                    id="income"
                    name="income"
                    type="number"
                    defaultValue={parent.income || ''}
                    placeholder="Monthly income"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h4 className="font-semibold mb-3 text-sm">Address Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    defaultValue={parent.address || ''}
                    placeholder="Street address"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={parent.city || ''}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    name="state"
                    defaultValue={parent.state || ''}
                    placeholder="State/Province"
                  />
                </div>
                <div>
                  <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    defaultValue={parent.zip_code || ''}
                    placeholder="ZIP Code"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    defaultValue={parent.country || 'Pakistan'}
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h4 className="font-semibold mb-3 text-sm">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="emergencyName">Contact Name</Label>
                  <Input
                    id="emergencyName"
                    name="emergencyName"
                    defaultValue={parent.emergency_contact_name || ''}
                    placeholder="Emergency contact name"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyRelation">Relationship</Label>
                  <Input
                    id="emergencyRelation"
                    name="emergencyRelation"
                    defaultValue={parent.emergency_contact_relation || ''}
                    placeholder="e.g., Brother, Friend"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyPhone">Phone</Label>
                  <Input
                    id="emergencyPhone"
                    name="emergencyPhone"
                    defaultValue={parent.emergency_contact_phone || ''}
                    placeholder="+92 XXX XXXXXXX"
                  />
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            <div>
              <h4 className="font-semibold mb-3 text-sm">Additional Information</h4>
              <CustomFieldsRenderer
                entityType="parent"
                values={editCustomFields}
                onChange={setEditCustomFields}
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={parent.notes || ''}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push(`/admin/parents/${parentId}`)} 
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
