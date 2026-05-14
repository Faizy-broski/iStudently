'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Phone, Calendar, Briefcase, User, Building, Hash } from 'lucide-react';
import { getAuthToken } from '@/lib/api/schools';
import { API_URL } from '@/config/api';

interface StaffDetails {
    id: string;
    profile_id: string;
    school_id: string;
    employee_number: string;
    title: string;
    department: string;
    qualifications: string[];
    specialization: string;
    date_of_joining: string;
    employment_type: string;
    is_active: boolean;
    profile?: {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        profile_photo_url: string;
        role: string;
    };
}

export default function ProfilePage() {
    const { profile } = useAuth();
    const [staffDetails, setStaffDetails] = useState<StaffDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStaffDetails = async () => {
            if (!profile?.id) return;

            // Only fetch staff details for librarian/staff roles
            if (profile.role !== 'librarian' && profile.role !== 'staff') {
                setLoading(false);
                return;
            }

            try {
                const token = await getAuthToken();
                const response = await fetch(`${API_URL}/staff/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const data = await response.json();

                if (data.success && data.data) {
                    setStaffDetails(data.data);
                }
            } catch (err: any) {
                console.error('Error fetching staff details:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchStaffDetails();
    }, [profile?.id, profile?.role]);

    const getInitials = () => {
        if (profile?.first_name && profile?.last_name) {
            return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
        }
        return 'U';
    };

    const getRoleDisplayName = (role?: string) => {
        if (!role) return 'User';
        return role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-[#57A3CC]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white">My Profile</h1>
                <p className="text-gray-500 mt-1">View your profile information</p>
            </div>

            {/* Profile Card */}
            <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-[#022172] to-[#57A3CC] h-32" />
                <CardContent className="relative pt-0 pb-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Avatar */}
                        <div className="-mt-16 md:-mt-12 flex-shrink-0">
                            <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                                <AvatarImage
                                    src={profile?.profile_photo_url || ''}
                                    alt={profile?.first_name || 'User'}
                                />
                                <AvatarFallback className="bg-[#022172] text-white text-3xl">
                                    {getInitials()}
                                </AvatarFallback>
                            </Avatar>
                        </div>

                        {/* Basic Info */}
                        <div className="flex-1 mt-4 md:mt-0">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {profile?.first_name} {profile?.last_name}
                                    </h2>
                                    <p className="text-gray-500">{profile?.email}</p>
                                </div>
                                <Badge className="bg-[#57A3CC] hover:bg-[#57A3CC]">
                                    {getRoleDisplayName(profile?.role)}
                                </Badge>
                            </div>

                            {/* Staff-specific info */}
                            {staffDetails && (
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Hash className="h-4 w-4" />
                                        <span className="text-sm">
                                            <span className="font-medium">Employee ID:</span> {staffDetails.employee_number || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Briefcase className="h-4 w-4" />
                                        <span className="text-sm">
                                            <span className="font-medium">Title:</span> {staffDetails.title || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Building className="h-4 w-4" />
                                        <span className="text-sm">
                                            <span className="font-medium">Department:</span> {staffDetails.department || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Calendar className="h-4 w-4" />
                                        <span className="text-sm">
                                            <span className="font-medium">Joined:</span>{' '}
                                            {staffDetails.date_of_joining
                                                ? new Date(staffDetails.date_of_joining).toLocaleDateString()
                                                : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                    <CardDescription>Your contact details</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Email Address</p>
                            <p className="font-medium">{profile?.email || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Phone className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Phone Number</p>
                            <p className="font-medium">{profile?.phone || 'N/A'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Employment Details - only for staff/librarian */}
            {staffDetails && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Employment Details</CardTitle>
                        <CardDescription>Your employment information</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Employment Type</p>
                            <p className="font-medium capitalize">{staffDetails.employment_type?.replace('_', ' ') || 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Status</p>
                            <Badge variant={staffDetails.is_active ? 'default' : 'secondary'}>
                                {staffDetails.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                        {staffDetails.specialization && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-500">Specialization</p>
                                <p className="font-medium">{staffDetails.specialization}</p>
                            </div>
                        )}
                        {Array.isArray(staffDetails.qualifications) && staffDetails.qualifications.length > 0 && (
                            <div className="p-3 bg-gray-50 rounded-lg md:col-span-2">
                                <p className="text-sm text-gray-500 mb-2">Qualifications</p>
                                <div className="flex flex-wrap gap-2">
                                    {staffDetails.qualifications.map((qual, index) => (
                                        <Badge key={index} variant="outline">{qual}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
