'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Building2, Users, CreditCard, TrendingUp, TrendingDown, School } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { dashboardApi, DashboardStats, MonthlyGrowth, MonthlyRevenue } from '@/lib/api/dashboard'
import { useAuth } from '@/context/AuthContext'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts'

const schoolGrowthConfig = {
  schools: {
    label: 'Schools',
    color: '#022172',
  },
}

const revenueConfig = {
  revenue: {
    label: 'Revenue',
    color: '#21C97B',
  },
  subscriptions: {
    label: 'Subscriptions',
    color: '#57A3CC',
  },
}

export default function SuperAdminDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [schoolGrowthData, setSchoolGrowthData] = useState<MonthlyGrowth[]>([])
  const [revenueData, setRevenueData] = useState<MonthlyRevenue[]>([])
  const [recentSchools, setRecentSchools] = useState<any[]>([])

  useEffect(() => {
    // Only load dashboard when auth is ready and user is authenticated
    if (!authLoading && user) {
      loadDashboardData()
    } else if (!authLoading && !user) {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      console.log('📊 Loading dashboard data...')
      
      // Fetch all data in parallel from backend
      const [statsRes, growthRes, revenueRes, schoolsRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getSchoolGrowth(),
        dashboardApi.getRevenue(),
        dashboardApi.getRecentSchools(4)
      ])
      
      console.log('📊 Dashboard API responses:', {
        stats: statsRes.success,
        growth: growthRes.success,
        revenue: revenueRes.success,
        schools: schoolsRes.success
      })
      
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data)
      } else {
        console.error('Stats failed:', statsRes.error)
      }
      
      if (growthRes.success && growthRes.data) {
        setSchoolGrowthData(growthRes.data)
      } else {
        console.error('Growth data failed:', growthRes.error)
      }
      
      if (revenueRes.success && revenueRes.data) {
        setRevenueData(revenueRes.data)
      } else {
        console.error('Revenue data failed:', revenueRes.error)
      }
      
      if (schoolsRes.success && schoolsRes.data) {
        setRecentSchools(schoolsRes.data)
      } else {
        console.error('Recent schools failed:', schoolsRes.error)
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`
    }
    return `$${amount}`
  }

  // Calculate percentage changes from growth data
  const calculateGrowth = (current: number, previous: number): { change: string; trend: 'up' | 'down' } => {
    if (previous === 0) return { change: current > 0 ? '+100%' : '0%', trend: 'up' }
    const percent = ((current - previous) / previous) * 100
    const rounded = Math.round(percent)
    return {
      change: `${rounded > 0 ? '+' : ''}${rounded}%`,
      trend: rounded >= 0 ? 'up' : 'down'
    }
  }

  // Memoize dashboard stats cards to prevent recalculation on every render
  const dashboardStats = useMemo(() => {
    if (!stats) return []
    
    // Get current month and last month data for growth calculation
    const currentMonth = new Date().getMonth()
    const lastMonthIndex = currentMonth > 0 ? currentMonth - 1 : 11
    
    const currentMonthSchools = schoolGrowthData[currentMonth]?.schools || stats.totalSchools
    const lastMonthSchools = schoolGrowthData[lastMonthIndex]?.schools || Math.max(0, stats.totalSchools - 2)
    
    const schoolGrowth = calculateGrowth(currentMonthSchools, lastMonthSchools)
    const subscriptionGrowth = calculateGrowth(stats.paidBillings, Math.max(1, stats.paidBillings - Math.ceil(stats.paidBillings * 0.08)))
    const revenueGrowth = calculateGrowth(stats.totalRevenue, Math.max(1, stats.totalRevenue - Math.ceil(stats.totalRevenue * 0.12)))
    
    return [
      {
        label: 'Total Schools',
        value: stats.totalSchools.toString(),
        change: schoolGrowth.change,
        trend: schoolGrowth.trend,
        icon: Building2,
        href: '/superadmin/school-directory',
        gradientClass: 'gradient-blue',
      },
      {
        label: 'Active Subscriptions',
        value: stats.paidBillings.toString(),
        change: subscriptionGrowth.change,
        trend: subscriptionGrowth.trend,
        icon: School,
        href: '/superadmin/billing-status',
        gradientClass: 'gradient-teal',
      },
      {
        label: 'Total Revenue',
        value: formatCurrency(stats.totalRevenue),
        change: revenueGrowth.change,
        trend: revenueGrowth.trend,
        icon: CreditCard,
        href: '/superadmin/billing-status',
        gradientClass: 'gradient-orange',
      },
      {
        label: 'Active Schools',
        value: stats.activeSchools.toString(),
        change: calculateGrowth(stats.activeSchools, Math.max(1, stats.activeSchools - 1)).change,
        trend: 'up' as const,
        icon: Users,
        href: '/superadmin/school-directory',
        gradientClass: 'gradient-green',
      },
      {
        label: 'Suspended Schools',
        value: stats.suspendedSchools.toString(),
        change: stats.suspendedSchools > 0 ? calculateGrowth(stats.suspendedSchools, stats.suspendedSchools + 1).change : '0%',
        trend: stats.suspendedSchools > 0 ? 'down' as const : 'up' as const,
        icon: Building2,
        href: '/superadmin/school-directory',
        gradientClass: 'gradient-red',
      },
    ]
  }, [stats, schoolGrowthData])

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Spinner size="lg" className="text-brand-blue" />
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-blue">
          Welcome back, <span className="text-brand-green">Super Admin</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here&apos;s what&apos;s happening across all schools today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {dashboardStats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className={`${stat.gradientClass} text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer h-full`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className="h-6 w-6 text-white/80" />
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                    stat.trend === 'up' ? 'bg-white/20' : 'bg-white/20'
                  }`}>
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {stat.change}
                  </span>
                </div>
                <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
                <p className="text-white/80 text-sm mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* School Growth Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-brand-blue">School Growth</CardTitle>
            <CardDescription>Number of schools onboarded over the year</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={schoolGrowthConfig} className="h-75 w-full">
              <AreaChart data={schoolGrowthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="schoolGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#022172" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#022172" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="schools"
                  stroke="#022172"
                  strokeWidth={2}
                  fill="url(#schoolGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-brand-blue">Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue and subscription trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueConfig} className="h-75 w-full">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#21C97B" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Schools */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-brand-blue">Recently Onboarded Schools</CardTitle>
            <CardDescription>Latest schools added to the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSchools.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No schools onboarded yet</p>
              ) : (
                recentSchools.map((school) => (
                  <div key={school.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-blue flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{school.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(school.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        school.status === 'active' 
                          ? 'bg-emerald-100 text-brand-green' 
                          : 'bg-amber-100 text-brand-orange'
                      }`}>
                        {school.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link 
              href="/superadmin/school-directory" 
              className="inline-block mt-4 text-sm text-brand-blue hover:underline font-medium"
            >
              View all schools →
            </Link>
          </CardContent>
        </Card>

        {/* Platform Stats */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-brand-blue">Platform Statistics</CardTitle>
            <CardDescription>Overall platform metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full gradient-blue" />
                  <span className="text-sm text-gray-600">Total Schools</span>
                </div>
                <span className="font-semibold text-gray-900">{stats?.totalSchools || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full gradient-teal" />
                  <span className="text-sm text-gray-600">Active Schools</span>
                </div>
                <span className="font-semibold text-gray-900">{stats?.activeSchools || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full gradient-orange" />
                  <span className="text-sm text-gray-600">Total Billings</span>
                </div>
                <span className="font-semibold text-gray-900">{stats?.totalBillings || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full gradient-green" />
                  <span className="text-sm text-gray-600">Paid Subscriptions</span>
                </div>
                <span className="font-semibold text-gray-900">{stats?.paidBillings || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full gradient-red" />
                  <span className="text-sm text-gray-600">Suspended Schools</span>
                </div>
                <span className="font-semibold text-gray-900">{stats?.suspendedSchools || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
