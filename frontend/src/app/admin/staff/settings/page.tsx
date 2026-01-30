'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'

export default function StaffSettingsPage() {
    const [designations, setDesignations] = useState<string[]>([
        'Librarian', 'Accountant', 'Clerk', 'Driver', 'Security Guard', 'Nurse', 'Receptionist'
    ])
    const [newDesignation, setNewDesignation] = useState('')

    // Placeholder for Custom Fields logic - would be similar to Student Custom Fields
    // For now we just show Designations as that's critical for "New Roles" requirement

    const addDesignation = () => {
        if (!newDesignation.trim()) return
        if (designations.includes(newDesignation.trim())) {
            toast.error('Designation already exists')
            return
        }
        setDesignations([...designations, newDesignation.trim()])
        setNewDesignation('')
        toast.success('Designation added')
        // Ideally save to backend
    }

    const removeDesignation = (role: string) => {
        if (role === 'Librarian') {
            toast.error('Cannot remove system role "Librarian"')
            return
        }
        setDesignations(designations.filter(d => d !== role))
        toast.success('Designation removed')
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Staff Settings</h1>
                <p className="text-gray-500 mt-1">Configure staff roles and custom fields</p>
            </div>

            <Tabs defaultValue="designations" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="designations">Staff Designations (Roles)</TabsTrigger>
                    <TabsTrigger value="fields">Custom Fields Template</TabsTrigger>
                </TabsList>

                <TabsContent value="designations" className="space-y-4 pt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage Designations</CardTitle>
                            <CardDescription>
                                Define the job titles available when adding new staff.
                                Note: "Librarian" is a special system role.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Enter new designation (e.g. Bus Conductor)"
                                    value={newDesignation}
                                    onChange={(e) => setNewDesignation(e.target.value)}
                                />
                                <Button onClick={addDesignation} className="shrink-0 bg-[#022172]">
                                    <Plus className="mr-2 h-4 w-4" /> Add Role
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {designations.map(role => (
                                    <div key={role} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group">
                                        <span className="font-medium text-sm">{role}</span>
                                        {role === 'Librarian' ? (
                                            <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-700 bg-purple-50">System</Badge>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => removeDesignation(role)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
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
