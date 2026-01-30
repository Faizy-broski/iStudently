"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Building2, Plus, Pencil, Trash2, Loader2 } from "lucide-react"
import { getCampuses, createCampus, updateCampus, deleteCampus, Campus, CreateCampusData } from "@/lib/api/setup-status"

export default function CampusesPage() {
    const [campuses, setCampuses] = useState<Campus[]>([])
    const [loading, setLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingCampus, setEditingCampus] = useState<Campus | null>(null)

    // Form state
    const [formData, setFormData] = useState<CreateCampusData>({
        name: "",
        address: "",
        contact_email: "",
        phone: ""
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
        setFormData({ name: "", address: "", contact_email: "", phone: "" })
        setEditingCampus(null)
    }

    const handleOpenDialog = (campus?: Campus) => {
        if (campus) {
            setEditingCampus(campus)
            setFormData({
                name: campus.name,
                address: campus.address || "",
                contact_email: campus.contact_email || "",
                phone: campus.phone || ""
            })
        } else {
            resetForm()
        }
        setDialogOpen(true)
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
            if (editingCampus) {
                await updateCampus(editingCampus.id, formData)
                toast.success("Campus updated successfully")
            } else {
                await createCampus(formData)
                toast.success("Campus created successfully")
            }
            handleCloseDialog()
            loadCampuses()
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
                    <DialogContent>
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
                            <div className="space-y-2">
                                <Label htmlFor="name">Campus Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Main Campus, Downtown Branch"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Textarea
                                    id="address"
                                    placeholder="Enter the campus address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    rows={2}
                                />
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
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
                                            <Building2 className="h-5 w-5 text-white" />
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
                                {campus.address && <p className="mb-1">{campus.address}</p>}
                                {campus.contact_email && <p className="mb-1">{campus.contact_email}</p>}
                                {campus.phone && <p>{campus.phone}</p>}
                                {!campus.address && !campus.contact_email && !campus.phone && (
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
