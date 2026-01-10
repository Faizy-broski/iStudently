"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { billingPlansApi, BillingPlan, calculateBillingAmount } from "@/lib/api/billing";

const billingFormSchema = z.object({
  school_id: z.string().min(1, "School ID is required"),
  school_name: z.string().min(2, "School name is required"),
  billing_plan_id: z.string().min(1, "Billing plan is required"),
  subscription_plan: z.string().min(1, "Subscription plan is required"),
  billing_cycle: z.string().min(1, "Billing cycle is required"),
  amount: z.number().min(1, "Amount must be greater than 0"),
  due_date: z.string().min(1, "Due date is required"),
  payment_status: z.enum(["paid", "unpaid", "overdue", "pending"]),
  invoice_number: z.string().min(1, "Invoice number is required"),
  payment_date: z.string().optional().nullable(),
});

type BillingFormData = z.infer<typeof billingFormSchema>;

interface BillingRecord {
  id: string;
  school_id: string;
  school_name: string;
  billing_plan_id: string;
  billing_cycle: string;
  amount: number;
  due_date: string;
  payment_status: "paid" | "unpaid" | "overdue" | "pending";
  payment_date: string | null;
  invoice_number: string;
  subscription_plan: string;
}

interface BillingFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<BillingRecord, "id">) => void;
  editingRecord: BillingRecord | null;
}

export default function BillingFormModal({
  open,
  onClose,
  onSubmit,
  editingRecord,
}: BillingFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<BillingFormData>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      school_id: "",
      school_name: "",
      billing_plan_id: "",
      subscription_plan: "",
      billing_cycle: "Monthly",
      amount: 0,
      due_date: "",
      payment_status: "unpaid",
      invoice_number: "",
      payment_date: null,
    },
  });

  // Fetch billing plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const plans = await billingPlansApi.getAll();
        setBillingPlans(plans);
        if (plans.length > 0 && !editingRecord) {
          setValue("billing_plan_id", plans[0].id);
          setValue("subscription_plan", plans[0].name);
        }
      } catch (error: any) {
        console.error("Error loading plans:", error);
        toast.error("Failed to load billing plans");
      } finally {
        setLoadingPlans(false);
      }
    };
    
    if (open) {
      fetchPlans();
    }
  }, [open, setValue, editingRecord]);

  useEffect(() => {
    if (editingRecord) {
      reset({
        school_id: editingRecord.school_id,
        school_name: editingRecord.school_name,
        billing_plan_id: editingRecord.billing_plan_id || "",
        subscription_plan: editingRecord.subscription_plan,
        billing_cycle: editingRecord.billing_cycle,
        amount: editingRecord.amount,
        due_date: editingRecord.due_date,
        payment_status: editingRecord.payment_status,
        invoice_number: editingRecord.invoice_number,
        payment_date: editingRecord.payment_date,
      });
    } else {
      // Generate invoice number for new records
      const invoiceNum = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const defaultPlan = billingPlans[0];
      reset({
        school_id: "",
        school_name: "",
        billing_plan_id: defaultPlan?.id || "",
        subscription_plan: defaultPlan?.name || "",
        billing_cycle: "Monthly",
        amount: defaultPlan?.monthly_price || 0,
        due_date: "",
        payment_status: "unpaid",
        invoice_number: invoiceNum,
        payment_date: null,
      });
    }
  }, [editingRecord, reset, open, billingPlans]);

  const selectedPlanId = watch("billing_plan_id");
  const selectedCycle = watch("billing_cycle");

  // Auto-update amount based on selected plan and cycle
  useEffect(() => {
    const plan = billingPlans.find(p => p.id === selectedPlanId);
    if (plan) {
      const amount = calculateBillingAmount(plan, selectedCycle as any);
      setValue("amount", amount);
      setValue("subscription_plan", plan.name);
    }
  }, [selectedPlanId, selectedCycle, setValue, billingPlans]);

  const handleFormSubmit = async (data: BillingFormData) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      reset();
    } catch (error) {
      // Error handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingRecord ? "Edit Billing Record" : "Create Billing Record"}</SheetTitle>
          <SheetDescription>
            {editingRecord
              ? "Update billing information for the school"
              : "Add a new billing record for a school"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 mt-6">
          {/* School ID */}
          <div className="space-y-2">
            <Label htmlFor="school_id">School ID *</Label>
            <Input
              id="school_id"
              {...register("school_id")}
              placeholder="sch_001"
              disabled={!!editingRecord}
            />
            {errors.school_id && (
              <p className="text-sm text-red-500">{errors.school_id.message}</p>
            )}
          </div>

          {/* School Name */}
          <div className="space-y-2">
            <Label htmlFor="school_name">School Name *</Label>
            <Input
              id="school_name"
              {...register("school_name")}
              placeholder="Enter school name"
            />
            {errors.school_name && (
              <p className="text-sm text-red-500">{errors.school_name.message}</p>
            )}
          </div>

          {/* Invoice Number */}
          <div className="space-y-2">
            <Label htmlFor="invoice_number">Invoice Number *</Label>
            <Input
              id="invoice_number"
              {...register("invoice_number")}
              placeholder="INV-2026-001"
              className="font-mono"
              disabled={!!editingRecord}
            />
            {errors.invoice_number && (
              <p className="text-sm text-red-500">{errors.invoice_number.message}</p>
            )}
          </div>

          {/* Subscription Plan */}
          <div className="space-y-2">
            <Label htmlFor="subscription_plan">Subscription Plan *</Label>
            <Select
              value={watch("billing_plan_id")}
              onValueChange={(value) => setValue("billing_plan_id", value)}
              disabled={loadingPlans || billingPlans.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingPlans ? "Loading plans..." : billingPlans.length === 0 ? "No plans available" : "Select plan"} />
              </SelectTrigger>
              <SelectContent>
                {billingPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - ${plan.monthly_price}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.billing_plan_id && (
              <p className="text-sm text-red-500">{errors.billing_plan_id.message}</p>
            )}
            {billingPlans.length === 0 && !loadingPlans && (
              <p className="text-sm text-amber-600">Please create billing plans first in the Plans tab</p>
            )}
          </div>

          {/* Billing Cycle */}
          <div className="space-y-2">
            <Label htmlFor="billing_cycle">Billing Cycle *</Label>
            <Select
              value={watch("billing_cycle")}
              onValueChange={(value) => setValue("billing_cycle", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select billing cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Quarterly">Quarterly</SelectItem>
                <SelectItem value="Yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            {errors.billing_cycle && (
              <p className="text-sm text-red-500">{errors.billing_cycle.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD) *</Label>
            <Input
              id="amount"
              type="number"
              {...register("amount", { valueAsNumber: true })}
              placeholder="299"
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date *</Label>
            <Input
              id="due_date"
              type="date"
              {...register("due_date")}
            />
            {errors.due_date && (
              <p className="text-sm text-red-500">{errors.due_date.message}</p>
            )}
          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <Label htmlFor="payment_status">Payment Status *</Label>
            <Select
              value={watch("payment_status")}
              onValueChange={(value: any) => setValue("payment_status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            {errors.payment_status && (
              <p className="text-sm text-red-500">{errors.payment_status.message}</p>
            )}
          </div>

          {/* Payment Date (conditional) */}
          {watch("payment_status") === "paid" && (
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                {...register("payment_date")}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 hover:bg-gray-100 transition-all duration-300"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gradient-blue hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingRecord ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{editingRecord ? "Update Billing" : "Create Billing"}</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
