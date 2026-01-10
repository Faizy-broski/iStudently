import { createClient } from "@/lib/supabase/client";

// Create a single Supabase client instance to reuse across all API calls
const supabase = createClient();

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  quarterly_price: number;
  yearly_price: number;
  max_students: number | null;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface BillingRecord {
  id: string;
  school_id: string;
  school_name?: string;
  billing_plan_id: string;
  subscription_plan?: string;
  billing_cycle: "Monthly" | "Quarterly" | "Yearly";
  amount: number;
  due_date: string;
  payment_status: "paid" | "unpaid" | "overdue" | "pending";
  payment_date: string | null;
  invoice_number: string;
  start_date: string;
  created_at?: string;
}

export interface CreateBillingRecordData {
  school_id: string;
  billing_plan_id: string;
  billing_cycle: "Monthly" | "Quarterly" | "Yearly";
  amount: number;
  due_date: string;
  start_date: string;
  payment_status: "paid" | "unpaid" | "overdue" | "pending";
}

// Billing Plans API
export const billingPlansApi = {
  async getAll(): Promise<BillingPlan[]> {
    const { data, error } = await supabase
      .from("billing_plans")
      .select("*")
      .eq("is_active", true)
      .order("monthly_price", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(plan: Omit<BillingPlan, "id" | "created_at">): Promise<BillingPlan> {
    const { data, error } = await supabase
      .from("billing_plans")
      .insert([plan])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, plan: Partial<BillingPlan>): Promise<BillingPlan> {
    const { data, error } = await supabase
      .from("billing_plans")
      .update(plan)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("billing_plans")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

// Billing Records API
export const billingRecordsApi = {
  async getAll(): Promise<BillingRecord[]> {
    const { data, error } = await supabase
      .from("billing_records")
      .select(`
        *,
        schools!inner(name),
        billing_plans!inner(name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((record: any) => ({
      ...record,
      school_name: record.schools?.name,
      subscription_plan: record.billing_plans?.name,
    }));
  },

  async getBySchoolId(schoolId: string): Promise<BillingRecord[]> {
    const { data, error } = await supabase
      .from("billing_records")
      .select(`
        *,
        schools!inner(name),
        billing_plans!inner(name)
      `)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((record: any) => ({
      ...record,
      school_name: record.schools?.name,
      subscription_plan: record.billing_plans?.name,
    }));
  },

  async create(billingData: CreateBillingRecordData): Promise<BillingRecord> {
    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const { data, error } = await supabase
      .from("billing_records")
      .insert([
        {
          ...billingData,
          invoice_number: invoiceNumber,
        },
      ])
      .select(`
        *,
        schools!inner(name),
        billing_plans!inner(name)
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      school_name: data.schools?.name,
      subscription_plan: data.billing_plans?.name,
    };
  },

  async update(id: string, updates: Partial<BillingRecord>): Promise<BillingRecord> {
    const { data, error } = await supabase
      .from("billing_records")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        schools!inner(name),
        billing_plans!inner(name)
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      school_name: data.schools?.name,
      subscription_plan: data.billing_plans?.name,
    };
  },

  async markAsPaid(id: string): Promise<{ success: true; payment_date: string }> {
    const paymentDate = new Date().toISOString().split("T")[0];
    
    console.log('💳 Marking billing record as paid:', id);
    
    const { error } = await supabase
      .from("billing_records")
      .update({
        payment_status: "paid",
        payment_date: paymentDate,
      })
      .eq("id", id);

    if (error) {
      console.error('❌ Mark as paid error:', error);
      throw new Error(error.message || 'Failed to update payment status');
    }

    console.log('✅ Payment status updated successfully');

    return {
      success: true,
      payment_date: paymentDate
    };
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("billing_records")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

// Helper function to calculate amount based on plan and cycle
export function calculateBillingAmount(
  plan: BillingPlan,
  cycle: "Monthly" | "Quarterly" | "Yearly"
): number {
  switch (cycle) {
    case "Monthly":
      return plan.monthly_price;
    case "Quarterly":
      return plan.quarterly_price;
    case "Yearly":
      return plan.yearly_price;
    default:
      return plan.monthly_price;
  }
}

// Helper function to calculate due date
export function calculateDueDate(startDate: string, cycle: "Monthly" | "Quarterly" | "Yearly"): string {
  const date = new Date(startDate);
  
  switch (cycle) {
    case "Monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "Quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "Yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split("T")[0];
}
