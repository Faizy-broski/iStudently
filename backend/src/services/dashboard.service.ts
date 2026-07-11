import { supabase } from '../config/supabase'

interface DashboardStats {
  totalSchools: number
  activeSchools: number
  suspendedSchools: number
  totalRevenue: number
  totalBillings: number
  paidBillings: number
  pendingBillings: number
  overdueBillings: number
}

interface MonthlyGrowth {
  month: string
  schools: number
}

interface MonthlyRevenue {
  month: string
  revenue: number
  subscriptions: number
}

export class DashboardService {
  /**
   * Get aggregated dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // Get school stats (root schools only, excluding campuses)
    const { data: schools } = await supabase
      .from('schools')
      .select('status')
      .is('parent_school_id', null)

    const totalSchools = schools?.length || 0
    const activeSchools = schools?.filter(s => s.status === 'active').length || 0
    const suspendedSchools = schools?.filter(s => s.status === 'suspended').length || 0

    // Get billing stats with aggregation
    const { data: billingStats } = await supabase
      .from('billing_records')
      .select('amount, payment_status')

    const totalRevenue = billingStats?.reduce((sum, b) => {
      return b.payment_status === 'paid' ? sum + b.amount : sum
    }, 0) || 0

    const totalBillings = billingStats?.length || 0
    const paidBillings = billingStats?.filter(b => b.payment_status === 'paid').length || 0
    const pendingBillings = billingStats?.filter(b => b.payment_status === 'pending').length || 0
    const overdueBillings = billingStats?.filter(b => b.payment_status === 'overdue').length || 0

    return {
      totalSchools,
      activeSchools,
      suspendedSchools,
      totalRevenue,
      totalBillings,
      paidBillings,
      pendingBillings,
      overdueBillings
    }
  }

  /**
   * Get school growth data by month for a specific year
   */
  async getSchoolGrowth(year: number): Promise<MonthlyGrowth[]> {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    // Get all root schools (excluding campuses) with their creation dates
    const { data: allSchools } = await supabase
      .from('schools')
      .select('created_at')
      .is('parent_school_id', null)
      .order('created_at', { ascending: true })

    if (!allSchools || allSchools.length === 0) {
      return monthNames.map(month => ({ month, schools: 0 }))
    }

    // Count schools before this year
    const schoolsBeforeYear = allSchools.filter(s => 
      new Date(s.created_at).getFullYear() < year
    ).length

    // Group schools created in this year by month
    const schoolsThisYearByMonth: Record<number, number> = {}
    allSchools.forEach(school => {
      const date = new Date(school.created_at)
      if (date.getFullYear() === year) {
        const month = date.getMonth()
        schoolsThisYearByMonth[month] = (schoolsThisYearByMonth[month] || 0) + 1
      }
    })

    // Build cumulative chart data
    let cumulative = schoolsBeforeYear
    return monthNames.map((month, index) => {
      cumulative += schoolsThisYearByMonth[index] || 0
      return { month, schools: cumulative }
    })
  }

  /**
   * Get revenue data by month for a specific year
   */
  async getRevenueData(year: number): Promise<MonthlyRevenue[]> {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { data: billings } = await supabase
      .from('billing_records')
      .select('amount, payment_status, created_at, start_date')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // Group by month
    const revenueByMonth: Record<number, { revenue: number; count: number }> = {}
    billings?.forEach(billing => {
      const date = new Date(billing.created_at || billing.start_date)
      const month = date.getMonth()
      
      if (!revenueByMonth[month]) {
        revenueByMonth[month] = { revenue: 0, count: 0 }
      }
      
      if (billing.payment_status === 'paid') {
        revenueByMonth[month].revenue += billing.amount
      }
      revenueByMonth[month].count += 1
    })

    return monthNames.map((month, index) => ({
      month,
      revenue: revenueByMonth[index]?.revenue || 0,
      subscriptions: revenueByMonth[index]?.count || 0
    }))
  }

  /**
   * Get recently added schools
   */
  async getRecentSchools(limit: number = 4) {
    const { data: schools } = await supabase
      .from('schools')
      .select('*')
      .is('parent_school_id', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    return schools || []
  }

  /**
   * Get platform-wide settings (super admin)
   */
  async getPlatformSettings(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'general')
      .single()

    if (error || !data) {
      return { currency: 'USD', support_email: 'support@studently.com', max_schools: 1000 }
    }

    return data.value as Record<string, any>
  }

  /**
   * Update platform-wide settings (super admin)
   */
  async updatePlatformSettings(updates: Record<string, any>): Promise<Record<string, any>> {
    const current = await this.getPlatformSettings()
    const merged = { ...current, ...updates }

    const { data, error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'general', value: merged, updated_at: new Date().toISOString() })
      .select('value')
      .single()

    if (error) {
      throw new Error(`Failed to update platform settings: ${error.message}`)
    }

    return data?.value as Record<string, any>
  }

  /**
   * Default login page appearance — matches the page's current hardcoded look.
   */
  private readonly defaultLoginPageConfig: Record<string, any> = {
    background_type: 'gradient', // 'gradient' | 'color' | 'image'
    gradient_from: '#57A3CC',
    gradient_to: '#022172',
    background_color: '#022172',
    background_image_url: null,
    background_image_opacity: 1,
    text_color_left: '#022172',
    text_color_right: '#ffffff',
    logo_url: null,
    form_offset_x: 0,
    form_offset_y: 0,
    form_width: 448,
    // Text content overrides — blank means "use the built-in default translation"
    title_en: '',
    title_ar: '',
    subtitle_en: '',
    subtitle_ar: '',
    heading_en: '',
    heading_ar: '',
  }

  /**
   * Get the global login page appearance config (public — read pre-login).
   */
  async getLoginPageConfig(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'login_page')
      .single()

    if (error || !data) {
      return this.defaultLoginPageConfig
    }

    return { ...this.defaultLoginPageConfig, ...(data.value as Record<string, any>) }
  }

  /**
   * Update the global login page appearance config (super admin only).
   */
  async updateLoginPageConfig(updates: Record<string, any>): Promise<Record<string, any>> {
    const current = await this.getLoginPageConfig()
    const merged = { ...current, ...updates }

    const { data, error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'login_page', value: merged, updated_at: new Date().toISOString() })
      .select('value')
      .single()

    if (error) {
      throw new Error(`Failed to update login page config: ${error.message}`)
    }

    return data?.value as Record<string, any>
  }

  /**
   * Reset the login page appearance config to defaults.
   */
  async resetLoginPageConfig(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('platform_settings')
      .upsert({
        key: 'login_page',
        value: this.defaultLoginPageConfig,
        updated_at: new Date().toISOString(),
      })
      .select('value')
      .single()

    if (error) {
      throw new Error(`Failed to reset login page config: ${error.message}`)
    }

    return data?.value as Record<string, any>
  }
}
