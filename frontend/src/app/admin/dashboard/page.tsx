"use client";

import { useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, TrendingUp, GraduationCap, Bookmark, RefreshCw } from "lucide-react";
import { useSchoolDashboard } from "@/hooks/useSchoolDashboard";
import { Spinner } from "@/components/ui/spinner";
import { 
  Area, 
  AreaChart, 
  CartesianGrid, 
  Legend, 
  Line, 
  LineChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis
} from "recharts";

export default function AdminDashboard() {
  // Use SWR hook for efficient data fetching with automatic revalidation
  const {
    stats,
    studentGrowthData,
    attendanceData,
    gradeDistribution,
    loading,
    error,
    refreshDashboard,
    isValidating
  } = useSchoolDashboard();

  // Log any errors for debugging
  useEffect(() => {
    if (error) {
      console.error('Dashboard error:', error)
    }
  }, [error])

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  // Memoized stats cards
  const statsCards = useMemo(() => {
    if (!stats) return [];
    
    return [
      {
        label: 'Total Students',
        value: stats.totalStudents,
        icon: Users,
        gradientClass: 'gradient-blue',
        showTrend: true
      },
      {
        label: 'Total Teachers',
        value: stats.totalTeachers,
        icon: GraduationCap,
        gradientClass: 'gradient-teal'
      },
      {
        label: 'Active Courses',
        value: stats.activeCourses,
        icon: BookOpen,
        gradientClass: 'gradient-orange'
      },
      {
        label: 'Attendance Rate',
        value: `${stats.attendanceRate}%`,
        icon: Calendar,
        gradientClass: 'gradient-blue',
        showTrendIcon: stats.attendanceRate >= 90
      }
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Spinner size="lg" className="text-brand-blue" />
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Failed to load dashboard</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={refreshDashboard}
            className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-900 dark:text-white">School Admin Dashboard</h1>
          <p className="text-gray-600 mt-2 dark:text-gray-300">Manage your school operations and track performance</p>
        </div>
        <button
          onClick={refreshDashboard}
          disabled={isValidating}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Refresh dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <Card key={index} className={`${stat.gradientClass} text-white`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className="h-8 w-8 text-white/80" />
                {stat.showTrend && <TrendingUp className="h-5 w-5 text-white/80" />}
                {stat.showTrendIcon && <TrendingUp className="h-5 w-5 text-white/80" />}
              </div>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-white/80 text-sm mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Student Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Student Enrollment (2026)</CardTitle>
            <CardDescription>Cumulative student enrollment over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={studentGrowthData}>
                <defs>
                  <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #ddd',
                    borderRadius: '8px' 
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="students" 
                  stroke="#3B82F6" 
                  fillOpacity={1} 
                  fill="url(#colorStudents)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance</CardTitle>
            <CardDescription>Last 7 days attendance tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="date" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #ddd',
                    borderRadius: '8px' 
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="absent" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  dot={{ fill: '#EF4444', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Grade Distribution</CardTitle>
            <CardDescription>Students by grade level</CardDescription>
          </CardHeader>
          <CardContent>
            {gradeDistribution.length > 0 ? (
              <div className="space-y-4">
                {gradeDistribution.map((item, index) => (
                  <div key={item.grade} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                      <span className="text-sm font-medium">Grade {item.grade}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{item.count}</span>
                      <span className="text-sm text-gray-500">students</span>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Total Students</span>
                    <span className="text-2xl font-bold text-brand-blue">
                      {gradeDistribution.reduce((sum, item) => sum + item.count, 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No grade data available</p>
            )}
          </CardContent>
        </Card>

        {/* Library & Events Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Library & Activities</CardTitle>
            <CardDescription>Books and upcoming events</CardDescription>
          </CardHeader>
          <CardContent>
            {stats && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Bookmark className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Books</p>
                      <p className="text-xs text-gray-500">In library</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">{stats.libraryBooks}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <BookOpen className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Borrowed Books</p>
                      <p className="text-xs text-gray-500">Currently issued</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">{stats.borrowedBooks}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Upcoming Events</p>
                      <p className="text-xs text-gray-500">Active events</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">{stats.activeEvents}</span>
                </div>

                <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-purple-900">Staff Overview</p>
                      <p className="text-xs text-purple-700 mt-1">
                        {stats.totalStaff} total staff members ({stats.totalTeachers} teachers)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
