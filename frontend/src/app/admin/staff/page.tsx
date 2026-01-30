'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Users,
    Plus,
    Search,
    MoreVertical,
    Edit,
    Trash2,
    Shield,
    Briefcase,
    Mail,
    Phone,
    DollarSign,
    Save,
    Loader2,
    Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useStaff } from '@/hooks/useStaff'
import { deleteStaff, updateStaff, UpdateStaffDTO, Staff, getStaffById } from '@/lib/api/staff'
import { toast } from 'sonner'
import { EditCredentialsModal } from '@/components/admin/EditCredentialsModal'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

export default function StaffPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<'staff' | 'librarian' | 'all'>('all')
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<UpdateStaffDTO>({})

    const campusContext = useCampus()
    const { staff, totalPages, isLoading, mutate } = useStaff(page, 10, search, roleFilter, campusContext?.selectedCampus?.id)
    const { profile } = useAuth()

    // Credentials modal state
    const [credentialsModalOpen, setCredentialsModalOpen] = useState(false)
    const [credentialsStaff, setCredentialsStaff] = useState<Staff | null>(null)

    // Populate form when editing staff is selected
    useEffect(() => {
        if (editingStaff) {
            console.log('🔄 useEffect triggered - editingStaff:', editingStaff)
            
            // Extract staff data from API response
            const staffData = (editingStaff as any).data || editingStaff
            
            console.log('🔄 useEffect - staffData:', staffData)
            console.log('🔄 useEffect - staffData.title:', staffData.title)
            console.log('🔄 useEffect - staffData.base_salary:', staffData.base_salary)
            
            const newFormData = {
                title: staffData.title || '',
                department: staffData.department || '',
                qualifications: staffData.qualifications || '',
                specialization: staffData.specialization || '',
                employment_type: staffData.employment_type || 'full_time',
                is_active: staffData.is_active,
                base_salary: staffData.base_salary || 0
            }
            
            console.log('🔄 useEffect - Setting formData to:', newFormData)
            setFormData(newFormData)
        }
    }, [editingStaff])

    const handleEdit = async (member: Staff) => {
        console.log('🎯 handleEdit - Fetching fresh staff data with base_salary for:', member.id)
        
        // Fetch fresh staff data including base_salary
        const response = await getStaffById(member.id)
        
        if (!response) {
            toast.error('Failed to load staff details')
            return
        }
        
        // Extract staff data from API response wrapper
        const freshStaff = (response as any).data || response
        
        console.log('🎯 handleEdit - Fresh staff data loaded:', freshStaff)
        console.log('🎯 handleEdit - base_salary from fresh data:', freshStaff.base_salary)
        
        setEditingStaff(freshStaff)
        setEditDialogOpen(true)
    }

    const handleSave = async () => {
        if (!editingStaff) return

        setSaving(true)
        try {
            // Extract staff data if it's wrapped in API response
            const staffData = (editingStaff as any).data || editingStaff
            await updateStaff(staffData.id, formData)
            toast.success('Staff member updated successfully')
            setEditDialogOpen(false)
            setEditingStaff(null)
            mutate()
        } catch (error) {
            toast.error('Failed to update staff member')
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this staff member?')) return

        try {
            await deleteStaff(id)
            toast.success('Staff member deleted successfully')
            mutate()
        } catch (error) {
            toast.error('Failed to delete staff member')
            console.error(error)
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Staff Management</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage non-teaching staff and librarians</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/admin/staff/settings">
                        <Button variant="outline" className="border-[#57A3CC] dark:border-blue-500 text-[#022172] dark:text-blue-400">
                            <Shield className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </Link>
                    <Link href="/admin/staff/add-staff">
                        <Button className="bg-linear-to-r from-[#57A3CC] to-[#022172] dark:from-blue-600 dark:to-blue-800 text-white">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Staff
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-blue-100">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search by name, email, or ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={roleFilter === 'all' ? 'default' : 'outline'}
                            onClick={() => setRoleFilter('all')}
                            className={roleFilter === 'all' ? 'bg-[#022172]' : ''}
                        >
                            All
                        </Button>
                        <Button
                            variant={roleFilter === 'staff' ? 'default' : 'outline'}
                            onClick={() => setRoleFilter('staff')}
                            className={roleFilter === 'staff' ? 'bg-[#022172]' : ''}
                        >
                            Staff
                        </Button>
                        <Button
                            variant={roleFilter === 'librarian' ? 'default' : 'outline'}
                            onClick={() => setRoleFilter('librarian')}
                            className={roleFilter === 'librarian' ? 'bg-[#022172]' : ''}
                        >
                            Librarians
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 dark:bg-gray-900/50">
                            <TableHead>Staff Member</TableHead>
                            <TableHead>Role / Designation</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Loading staff...</TableCell>
                            </TableRow>
                        ) : staff.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                                    No staff members found
                                </TableCell>
                            </TableRow>
                        ) : (
                            staff.map((member: Staff) => (
                                <TableRow key={member.id} className="hover:bg-blue-50/30 dark:hover:bg-gray-700/30 transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-[#022172] dark:text-blue-300 font-semibold text-sm">
                                                {member.profile?.first_name?.[0]}{member.profile?.last_name?.[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-[#022172] dark:text-gray-200">
                                                    {member.profile?.first_name} {member.profile?.last_name}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    ID: {member.employee_number}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium dark:text-gray-200">{member.title || 'N/A'}</span>
                                            {member.profile?.role === 'librarian' && (
                                                <Badge variant="secondary" className="w-fit mt-1 text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/70 border-purple-200 dark:border-purple-800">
                                                    System Librarian
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-3 w-3" />
                                                {member.profile?.email}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-3 w-3" />
                                                {member.profile?.phone || 'N/A'}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <Briefcase className="h-3 w-3" />
                                            {member.department || 'N/A'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={member.is_active
                                                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                                                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                            }
                                        >
                                            {member.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleEdit(member)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                {member.profile?.role === 'librarian' && (
                                                    <DropdownMenuItem onClick={() => {
                                                        setCredentialsStaff(member)
                                                        setCredentialsModalOpen(true)
                                                    }}>
                                                        <Lock className="mr-2 h-4 w-4" /> Edit Credentials
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => handleDelete(member.id)}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    Page {page} of {totalPages || 1}
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || totalPages === 0}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Staff Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Name (read-only) */}
                        <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-[#022172] dark:text-blue-300 font-semibold">
                                {editingStaff?.profile?.first_name?.[0]}{editingStaff?.profile?.last_name?.[0]}
                            </div>
                            <div>
                                <p className="font-medium dark:text-gray-100">{editingStaff?.profile?.first_name} {editingStaff?.profile?.last_name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{editingStaff?.profile?.email}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Title/Designation</Label>
                                <Input
                                    value={formData.title || ''}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g., Accountant"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <Input
                                    value={formData.department || ''}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    placeholder="e.g., Finance"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Employment Type</Label>
                                <Select
                                    value={formData.employment_type}
                                    onValueChange={(val) => setFormData({ ...formData, employment_type: val as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full_time">Full Time</SelectItem>
                                        <SelectItem value="part_time">Part Time</SelectItem>
                                        <SelectItem value="contract">Contract</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={formData.is_active ? 'active' : 'inactive'}
                                    onValueChange={(val) => setFormData({ ...formData, is_active: val === 'active' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Qualifications</Label>
                            <Input
                                value={formData.qualifications || ''}
                                onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                                placeholder="e.g., BBA, MBA"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Specialization</Label>
                            <Input
                                value={formData.specialization || ''}
                                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                placeholder="e.g., Accounting, Library Science"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>
                                <DollarSign className="inline h-4 w-4 mr-1" />
                                Base Salary (Monthly)
                            </Label>
                            <Input
                                type="number"
                                value={formData.base_salary || 0}
                                onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 0 })}
                                placeholder="e.g., 30000"
                                min="0"
                                step="100"
                            />
                            <p className="text-xs text-gray-500">Required for payroll generation</p>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-[#022172]"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Credentials Modal */}
            {credentialsStaff && (
                <EditCredentialsModal
                    isOpen={credentialsModalOpen}
                    onClose={() => {
                        setCredentialsModalOpen(false)
                        setCredentialsStaff(null)
                    }}
                    entityId={credentialsStaff.id}
                    entityName={`${credentialsStaff.profile?.first_name} ${credentialsStaff.profile?.last_name}`}
                    entityType="staff"
                    schoolId={profile?.school_id || ''}
                    onSuccess={() => mutate()}
                />
            )}
        </div>
    )
}
