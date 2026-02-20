"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Building2, Plus, Pencil, Trash2, Loader2, Upload, X } from "lucide-react"
import { getCampuses, createCampus, updateCampus, deleteCampus, Campus, CreateCampusData } from "@/lib/api/setup-status"
import { createClient } from "@/lib/supabase/client"
import { useCampus } from "@/context/CampusContext"

export default function CampusesPage() {
    const campusContext = useCampus()
    const [campuses, setCampuses] = useState<Campus[]>([])
    const [loading, setLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingCampus, setEditingCampus] = useState<Campus | null>(null)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const logoInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [formData, setFormData] = useState<CreateCampusData>({
        name: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
        contact_email: "",
        phone: "",
        principal_name: "",
        short_name: "",
        school_number: "",
        logo_url: null
    })

    const loadCampuses = async () => {
        try {
            const data = await getCampuses()
            setCampuses(data)
        } catch (error) {
            console.error("Error loading campuses:", error)
            toast.error("Failed to load campuses")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCampuses()
    }, [])

    const resetForm = () => {
        setFormData({
            name: "",
            address: "",
            city: "",
            state: "",
            zip_code: "",
            contact_email: "",
            phone: "",
            principal_name: "",
            short_name: "",
            school_number: "",
            logo_url: null
        })
        setLogoFile(null)
        setLogoPreview(null)
        setEditingCampus(null)
    }

    const handleOpenDialog = (campus?: Campus) => {
        if (campus) {
            setEditingCampus(campus)
            setFormData({
                name: campus.name,
                address: campus.address || "",
                city: campus.city || "",
                state: campus.state || "",
                zip_code: campus.zip_code || "",
                contact_email: campus.contact_email || "",
                phone: campus.phone || "",
                principal_name: campus.principal_name || "",
                short_name: campus.short_name || "",
                school_number: campus.school_number || "",
                logo_url: campus.logo_url || null
            })
            setLogoFile(null)
            setLogoPreview(campus.logo_url || null)
        } else {
            resetForm()
        }
        setDialogOpen(true)
    }

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setLogoFile(file)
        setLogoPreview(URL.createObjectURL(file))
    }

    const handleRemoveLogo = () => {
        setLogoFile(null)
        setLogoPreview(null)
        setFormData(prev => ({ ...prev, logo_url: null }))
        if (logoInputRef.current) logoInputRef.current.value = ""
    }

    const handleCloseDialog = () => {
        setDialogOpen(false)
        resetForm()
    }

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error("Campus name is required")
            return
        }

        setIsSubmitting(true)
        try {
            let finalLogoUrl = formData.logo_url ?? null

            // Upload new logo if a file was selected
            if (logoFile) {
                const supabase = createClient()
                const ext = logoFile.name.split('.').pop()
                const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                const fileName = `${slug}-${Date.now()}.${ext}`
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('school-logos')
                    .upload(fileName, logoFile, { cacheControl: '3600', upsert: false })
                if (uploadError) throw new Error('Logo upload failed: ' + uploadError.message)
                const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(uploadData.path)
                finalLogoUrl = urlData.publicUrl
            }

            const payload = { ...formData, logo_url: finalLogoUrl }

            if (editingCampus) {
                await updateCampus(editingCampus.id, payload)
                toast.success("Campus updated successfully")
            } else {
                await createCampus(payload)
                toast.success("Campus created successfully")
            }
            handleCloseDialog()
            loadCampuses()
            // Bust the campus context cache so the sidebar logo updates immediately
            campusContext?.refreshCampuses()
        } catch (error) {
            console.error("Error saving campus:", error)
            toast.error(editingCampus ? "Failed to update campus" : "Failed to create campus")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (campus: Campus) => {
        if (!confirm(`Are you sure you want to delete "${campus.name}"?`)) return

        try {
            await deleteCampus(campus.id)
            toast.success("Campus deleted successfully")
            loadCampuses()
        } catch (error) {
            console.error("Error deleting campus:", error)
            toast.error("Failed to delete campus")
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                        Campus Management
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-2">
                        Manage your school campuses and branches
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            onClick={() => handleOpenDialog()}
                            className="bg-[#022172] hover:bg-[#022172]/90"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Campus
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editingCampus ? "Edit Campus" : "Add New Campus"}
                            </DialogTitle>
                            <DialogDescription>
                                {editingCampus
                                    ? "Update the campus details below."
                                    : "Enter the details for the new campus."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {/* Logo Upload */}
                            <div className="space-y-2">
                                <Label>Campus Logo</Label>
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                                        {logoPreview ? (
                                            <Image src={logoPreview} alt="Campus logo" width={80} height={80} className="object-contain w-full h-full" />
                                        ) : (
                                            <Building2 className="h-8 w-8 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                                            <Upload className="h-4 w-4 mr-2" />
                                            {logoPreview ? "Change Logo" : "Upload Logo"}
                                        </Button>
                                        {logoPreview && (
                                            <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={handleRemoveLogo}>
                                                <X className="h-4 w-4 mr-2" />
                                                Remove
                                            </Button>
                                        )}
                                        <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                                    </div>
                                    <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Campus Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Main Campus"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="short_name">Short Name</Label>
                                    <Input
                                        id="short_name"
                                        placeholder="e.g., MC"
                                        value={formData.short_name}
                                        onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="school_number">Campus Number/Code</Label>
                                <Input
                                    id="school_number"
                                    placeholder="Official campus code"
                                    value={formData.school_number}
                                    onChange={(e) => setFormData({ ...formData, school_number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Street Address</Label>
                                <Textarea
                                    id="address"
                                    placeholder="Enter the street address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    rows={2}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input
                                        id="city"
                                        placeholder="City"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="state">State</Label>
                                    <Input
                                        id="state"
                                        placeholder="State"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="zip">Zip Code</Label>
                                    <Input
                                        id="zip"
                                        placeholder="ZIP"
                                        value={formData.zip_code}
                                        onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Contact Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="campus@school.com"
                                        value={formData.contact_email}
                                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="+1 234 567 8900"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="principal">Principal of Campus</Label>
                                <Input
                                    id="principal"
                                    placeholder="Principal's name"
                                    value={formData.principal_name}
                                    onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleCloseDialog}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !formData.name.trim()}
                                className="bg-[#022172] hover:bg-[#022172]/90"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : editingCampus ? "Update Campus" : "Create Campus"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Campus List */}
            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardHeader>
                                <div className="h-5 bg-gray-200 rounded w-1/2" />
                                <div className="h-4 bg-gray-200 rounded w-3/4 mt-2" />
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            ) : campuses.length === 0 ? (
                <Card className="text-center py-12">
                    <CardContent>
                        <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Campuses Yet</h3>
                        <p className="text-gray-500 mb-4">
                            Get started by creating your first campus.
                        </p>
                        <Button
                            onClick={() => handleOpenDialog()}
                            className="bg-[#022172] hover:bg-[#022172]/90"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Campus
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {campuses.map((campus) => (
                        <Card key={campus.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center overflow-hidden">
                                            {campus.logo_url ? (
                                                <Image src={campus.logo_url} alt={campus.name} width={40} height={40} className="object-contain w-full h-full" />
                                            ) : (
                                                <Building2 className="h-5 w-5 text-white" />
                                            )}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{campus.name}</CardTitle>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${campus.status === 'active'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {campus.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleOpenDialog(campus)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(campus)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm text-gray-600">
                                {campus.short_name && (
                                    <p className="mb-1 font-medium text-gray-700">Short: {campus.short_name}</p>
                                )}
                                {campus.school_number && (
                                    <p className="mb-1 text-xs text-gray-500">Code: {campus.school_number}</p>
                                )}
                                {campus.address && <p className="mb-1">{campus.address}</p>}
                                {(campus.city || campus.state || campus.zip_code) && (
                                    <p className="mb-1">
                                        {[campus.city, campus.state, campus.zip_code].filter(Boolean).join(", ")}
                                    </p>
                                )}
                                {campus.principal_name && (
                                    <p className="mb-1"><span className="font-medium">Principal:</span> {campus.principal_name}</p>
                                )}
                                {campus.contact_email && <p className="mb-1">{campus.contact_email}</p>}
                                {campus.phone && <p>{campus.phone}</p>}
                                {!campus.address && !campus.contact_email && !campus.phone && !campus.principal_name && (
                                    <p className="text-gray-400 italic">No contact info provided</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
