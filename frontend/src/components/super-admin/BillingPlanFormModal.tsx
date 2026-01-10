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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, DollarSign, Users, Package } from "lucide-react";
import { BillingPlan } from "@/lib/api/billing";
import { Textarea } from "@/components/ui/textarea";

const billingPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().min(1, "Description is required"),
  monthly_price: z.coerce.number().min(0, "Monthly price must be a positive number"),
  quarterly_price: z.coerce.number().min(0, "Quarterly price must be a positive number"),
  yearly_price: z.coerce.number().min(0, "Yearly price must be a positive number"),
  max_students: z.coerce.number().min(1, "Max students must be at least 1"),
  features: z.string().min(1, "At least one feature is required"),
  is_active: z.boolean().default(true),
});

type BillingPlanFormData = z.infer<typeof billingPlanSchema>;

interface BillingPlanFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<BillingPlan, "id" | "created_at">) => void;
  editingPlan: BillingPlan | null;
}

export default function BillingPlanFormModal({
  open,
  onClose,
  onSubmit,
  editingPlan,
}: BillingPlanFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<BillingPlanFormData>({
    resolver: zodResolver(billingPlanSchema),
    defaultValues: {
      name: "",
      description: "",
      monthly_price: 0,
      quarterly_price: 0,
      yearly_price: 0,
      max_students: 100,
      features: "",
      is_active: true,
    },
  });

  const isActive = watch("is_active");

  useEffect(() => {
    if (editingPlan) {
      reset({
        name: editingPlan.name,
        description: editingPlan.description,
        monthly_price: editingPlan.monthly_price,
        quarterly_price: editingPlan.quarterly_price,
        yearly_price: editingPlan.yearly_price,
        max_students: editingPlan.max_students,
        features: editingPlan.features.join("\n"),
        is_active: editingPlan.is_active,
      });
    } else {
      reset({
        name: "",
        description: "",
        monthly_price: 0,
        quarterly_price: 0,
        yearly_price: 0,
        max_students: 100,
        features: "",
        is_active: true,
      });
    }
  }, [editingPlan, reset, open]);

  const handleFormSubmit = async (data: BillingPlanFormData) => {
    try {
      setIsSubmitting(true);

      // Convert features string to array (split by newlines)
      const featuresArray = data.features
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const planData: Omit<BillingPlan, "id" | "created_at"> = {
        name: data.name,
        description: data.description,
        monthly_price: data.monthly_price,
        quarterly_price: data.quarterly_price,
        yearly_price: data.yearly_price,
        max_students: data.max_students,
        features: featuresArray,
        is_active: data.is_active,
      };

      await onSubmit(planData);
      handleClose();
    } catch {
      toast.error("Error saving billing plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-135 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold text-brand-blue flex items-center gap-2">
            <Package className="h-6 w-6" />
            {editingPlan ? "Edit Billing Plan" : "Create Billing Plan"}
          </SheetTitle>
          <SheetDescription>
            {editingPlan
              ? "Update the billing plan details below"
              : "Create a new billing plan for schools to subscribe to"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 mt-6">
          {/* Plan Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-brand-blue font-semibold">
              Plan Name *
            </Label>
            <Input
              id="name"
              placeholder="e.g., Basic Plan, Premium Plan"
              {...register("name")}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-red-500 text-sm">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-brand-blue font-semibold">
              Description *
            </Label>
            <Textarea
              id="description"
              placeholder="Brief description of the plan"
              rows={3}
              {...register("description")}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-red-500 text-sm">{errors.description.message}</p>
            )}
          </div>

          {/* Pricing Section */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly_price" className="text-brand-blue font-semibold flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Monthly *
              </Label>
              <Input
                id="monthly_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("monthly_price")}
                className={errors.monthly_price ? "border-red-500" : ""}
              />
              {errors.monthly_price && (
                <p className="text-red-500 text-sm">{errors.monthly_price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quarterly_price" className="text-brand-blue font-semibold flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Quarterly *
              </Label>
              <Input
                id="quarterly_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("quarterly_price")}
                className={errors.quarterly_price ? "border-red-500" : ""}
              />
              {errors.quarterly_price && (
                <p className="text-red-500 text-sm">{errors.quarterly_price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="yearly_price" className="text-brand-blue font-semibold flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Yearly *
              </Label>
              <Input
                id="yearly_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("yearly_price")}
                className={errors.yearly_price ? "border-red-500" : ""}
              />
              {errors.yearly_price && (
                <p className="text-red-500 text-sm">{errors.yearly_price.message}</p>
              )}
            </div>
          </div>

          {/* Max Students */}
          <div className="space-y-2">
            <Label htmlFor="max_students" className="text-brand-blue font-semibold flex items-center gap-1">
              <Users className="h-4 w-4" />
              Max Students *
            </Label>
            <Input
              id="max_students"
              type="number"
              placeholder="100"
              {...register("max_students")}
              className={errors.max_students ? "border-red-500" : ""}
            />
            {errors.max_students && (
              <p className="text-red-500 text-sm">{errors.max_students.message}</p>
            )}
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label htmlFor="features" className="text-brand-blue font-semibold">
              Features * <span className="text-sm font-normal text-gray-500">(one per line)</span>
            </Label>
            <Textarea
              id="features"
              placeholder={"Unlimited classes\nStudent management\n24/7 support\nCustom reports"}
              rows={5}
              {...register("features")}
              className={errors.features ? "border-red-500" : ""}
            />
            {errors.features && (
              <p className="text-red-500 text-sm">{errors.features.message}</p>
            )}
            <p className="text-sm text-gray-500">
              Enter each feature on a new line
            </p>
          </div>

          {/* Is Active */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", checked as boolean)}
            />
            <Label
              htmlFor="is_active"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Active (available for selection during onboarding)
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 gradient-blue hover:shadow-lg transition-all duration-300"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingPlan ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>{editingPlan ? "Update Plan" : "Create Plan"}</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
