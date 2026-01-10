"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { School, Users, BookOpen, Calendar } from "lucide-react";

export default function AdminDashboard() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-blue">School Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your school operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="gradient-blue text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Users className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">0</div>
            <p className="text-white/80 text-sm mt-1">Total Students</p>
          </CardContent>
        </Card>

        <Card className="gradient-teal text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Users className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">0</div>
            <p className="text-white/80 text-sm mt-1">Total Teachers</p>
          </CardContent>
        </Card>

        <Card className="gradient-orange text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <BookOpen className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">0</div>
            <p className="text-white/80 text-sm mt-1">Active Courses</p>
          </CardContent>
        </Card>

        <Card className="gradient-blue text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Calendar className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">95.2%</div>
            <p className="text-white/80 text-sm mt-1">Attendance Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Welcome Message */}
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Your School Dashboard</CardTitle>
          <CardDescription>
            You have been successfully onboarded as a school administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            This is your admin dashboard where you can manage students, teachers, courses, and all school operations.
            The dashboard is currently under development. More features coming soon!
          </p>
        </CardContent>
      </Card>
    </>
  );
}
