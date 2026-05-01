'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Info, Loader2, Building, Globe, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCampus } from '@/context/CampusContext'
import { useStaffDesignations } from '@/hooks/useStaffDesignations'
import { createDesignation, deleteDesignation, seedDefaultDesignations } from '@/lib/api/staff-designations'

export default function StaffSettingsPage() {
    const [newDesignation, setNewDesignation] = useState('')
    const [designationScope, setDesignationScope] = useState<'school-wide' | 'campus-specific'>('school-wide')
    const [saving, setSaving] = useState(false)
    const [seeding, setSeeding] = useState(false)
    
    const campusContext = useCampus()
    const selectedCampusId = campusContext?.selectedCampus?.id
    
    // Fetch designations based on selected campus
    const { 
        designations, 
        schoolWideDesignations,
        campusSpecificDesignations,
        isLoading, 
        mutate,
        invalidateAll 
    } = useStaffDesignations(selectedCampusId)

    const handleAddDesignation = async () => {
        if (!newDesignation.trim()) {
            toast.error('Please enter a designation name')
            return
        }

        // Check for duplicates
        const exists = designations.some(
            d => d.name.toLowerCase() === newDesignation.trim().toLowerCase()
        )
        if (exists) {
            toast.error('Designation already exists')
            return
        }

        setSaving(true)
        try {
            const result = await createDesignation({
                name: newDesignation.trim(),
                campus_id: designationScope === 'campus-specific' ? selectedCampusId : null,
            })

            if (!result.success) {
                throw new Error(result.error || 'Failed to create designation')
            }

            setNewDesignation('')
            invalidateAll()
            mutate()
            toast.success('Designation added successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to add designation')
        } finally {
            setSaving(false)
        }
    }

    const handleRemoveDesignation = async (designation: { id: string; name: string; is_system: boolean }) => {
        if (designation.is_system) {
            toast.error(`Cannot remove system designation "${designation.name}"`)
            return
        }

        try {
            const result = await deleteDesignation(designation.id)
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to delete designation')
            }

            invalidateAll()
            mutate()
            toast.success('Designation removed')
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove designation')
        }
    }

    const handleSeedDefaults = async () => {
        setSeeding(true)
        try {
            const result = await seedDefaultDesignations()
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to seed designations')
            }

            invalidateAll()
            mutate()
            toast.success('Default designations added')
        } catch (error: any) {
            toast.error(error.message || 'Failed to seed designations')
        } finally {
            setSeeding(false)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Staff Settings</h1>
                <p className="text-gray-500 mt-1">Configure staff roles and custom fields</p>
            </div>

            {/* Campus Context Banner */}
            {campusContext?.selectedCampus && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Building className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-800">
                        Viewing designations for: <strong>{campusContext.selectedCampus.name}</strong>
                    </span>
                    <Badge variant="outline" className="ml-auto text-xs">
                        School-wide + Campus-specific
                    </Badge>
                </div>
            )}

            <Tabs defaultValue="designations" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="designations">Staff Designations (Roles)</TabsTrigger>
                    <TabsTrigger value="fields">Custom Fields Template</TabsTrigger>
                </TabsList>

                <TabsContent value="designations" className="space-y-4 pt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Manage Designations</CardTitle>
                                    <CardDescription>
                                        Define the job titles available when adding new staff.
                                        Create school-wide designations or campus-specific ones.
                                    </CardDescription>
                                </div>
                                {designations.length === 0 && !isLoading && (
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={handleSeedDefaults}
                                        disabled={seeding}
                                    >
                                        {seeding ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                        )}
                                        Add Defaults
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Add New Designation Form */}
                            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                <Label className="text-sm font-medium">Add New Designation</Label>
                                <div className="flex gap-4 flex-wrap">
                                    <Input
                                        placeholder="Enter designation name (e.g. Bus Conductor)"
                                        value={newDesignation}
                                        onChange={(e) => setNewDesignation(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddDesignation()}
                                        className="flex-1 min-w-[200px]"
                                        disabled={saving}
                                    />
                                    <Select 
                                        value={designationScope} 
                                        onValueChange={(v) => setDesignationScope(v as 'school-wide' | 'campus-specific')}
                                        disabled={saving || !selectedCampusId}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Scope" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="school-wide">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="h-3 w-3" />
                                                    School-wide
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="campus-specific" disabled={!selectedCampusId}>
                                                <div className="flex items-center gap-2">
                                                    <Building className="h-3 w-3" />
                                                    Campus Only
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        onClick={handleAddDesignation} 
                                        className="shrink-0 bg-[#022172]"
                                        disabled={saving || !newDesignation.trim()}
                                    >
                                        {saving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="mr-2 h-4 w-4" />
                                        )}
                                        Add Role
                                    </Button>
                                </div>
                                {!selectedCampusId && (
                                    <p className="text-xs text-gray-500">
                                        💡 Select a campus from the header to enable campus-specific designations
                                    </p>
                                )}
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                    <span className="ml-2 text-gray-500">Loading designations...</span>
                                </div>
                            ) : designations.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                    <p>No designations found.</p>
                                    <p className="text-sm">Add your first designation or click "Add Defaults" to get started.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* School-wide Designations */}
                                    {schoolWideDesignations.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <Globe className="h-4 w-4 text-gray-500" />
                                                <h3 className="text-sm font-medium text-gray-700">School-wide Designations</h3>
                                                <Badge variant="secondary" className="text-xs">
                                                    {schoolWideDesignations.length}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {schoolWideDesignations.map(designation => (
                                                    <div 
                                                        key={designation.id} 
                                                        className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors group"
                                                    >
                                                        <span className="font-medium text-sm">{designation.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            {designation.is_system ? (
                                                                <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-700 bg-purple-50">
                                                                    System
                                                                </Badge>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => handleRemoveDesignation(designation)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Campus-specific Designations */}
                                    {campusSpecificDesignations.length > 0 && (
                                        <div>
                                            <Separator className="my-4" />
                                            <div className="flex items-center gap-2 mb-3">
                                                <Building className="h-4 w-4 text-blue-500" />
                                                <h3 className="text-sm font-medium text-gray-700">
                                                    Campus-specific Designations
                                                    {campusContext?.selectedCampus && (
                                                        <span className="font-normal text-gray-500 ml-1">
                                                            ({campusContext.selectedCampus.name})
                                                        </span>
                                                    )}
                                                </h3>
                                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                                    {campusSpecificDesignations.length}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {campusSpecificDesignations.map(designation => (
                                                    <div 
                                                        key={designation.id} 
                                                        className="flex items-center justify-between p-3 border border-blue-100 rounded-lg bg-blue-50/50 hover:bg-blue-50 transition-colors group"
                                                    >
                                                        <span className="font-medium text-sm">{designation.name}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleRemoveDesignation(designation)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="fields" className="pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Custom Fields</CardTitle>
                            <CardDescription>
                                Define additional fields to capture for staff members (e.g., License Number, Shift Time).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 border-2 border-dashed rounded-lg">
                                <Info className="h-8 w-8 mb-2 text-gray-400" />
                                <p className="font-medium">Custom Fields Manager</p>
                                <p className="text-sm">To be implemented. Will use the same system as Student Custom Fields.</p>
                                <Button variant="outline" className="mt-4" disabled>Coming Soon</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
