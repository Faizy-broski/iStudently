"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  DollarSign, 
  Plus, 
  Edit, 
  Trash2,
  Users,
  RefreshCw,
  CheckCircle2,
  Package
} from "lucide-react";
import ConfirmationDialog from "@/components/super-admin/ConfirmationDialog";
import BillingPlanFormModal from "@/components/super-admin/BillingPlanFormModal";
import { billingPlansApi, BillingPlan } from "@/lib/api/billing";

export default function BillingPlansPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await billingPlansApi.getAll();
      setPlans(data);
    } catch (error: any) {
      console.error("Error loading plans:", error);
      if (error.message?.includes("billing_plans") || error.message?.includes("relation")) {
        toast.error("Billing tables not set up", {
          description: "Please run the database migration. See BILLING_SETUP.md",
          duration: 8000,
        });
      } else {
        toast.error("Error loading billing plans", {
          description: error.message
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (data: Omit<BillingPlan, "id" | "created_at" | "is_active">) => {
    try {
      const newPlan = await billingPlansApi.create({
        ...data,
        is_active: true,
      });
      setPlans(prev => [...prev, newPlan]);
      toast.success("Billing plan created successfully");
      setShowFormModal(false);
    } catch (error: any) {
      toast.error("Error creating plan", {
        description: error.message
      });
      throw error;
    }
  };

  const handleUpdatePlan = async (data: Omit<BillingPlan, "id" | "created_at" | "is_active">) => {
    if (!editingPlan) return;

    try {
      const updatedPlan = await billingPlansApi.update(editingPlan.id, data);
      setPlans(prev =>
        prev.map(plan => (plan.id === editingPlan.id ? updatedPlan : plan))
      );
      toast.success("Billing plan updated successfully");
      setShowFormModal(false);
      setEditingPlan(null);
    } catch (error: any) {
      toast.error("Error updating plan", {
        description: error.message
      });
      throw error;
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;

    try {
      setIsProcessing(true);
      await billingPlansApi.delete(selectedPlan.id);
      setPlans(prev => prev.filter(plan => plan.id !== selectedPlan.id));
      toast.success("Billing plan deleted", {
        description: `${selectedPlan.name} has been removed`
      });
      setShowDeleteDialog(false);
      setSelectedPlan(null);
    } catch (error: any) {
      toast.error("Error deleting plan", {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue">
            Billing Plans
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage subscription plans available for schools
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingPlan(null);
              setShowFormModal(true);
            }}
            className="gap-2 gradient-blue hover:shadow-lg transition-all duration-300"
          >
            <Plus className="h-4 w-4" />
            Add Plan
          </Button>
          <Button
            onClick={fetchPlans}
            variant="outline"
            className="gap-2 hover:gradient-blue hover:text-white transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gradient-blue text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Package className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">{plans.length}</div>
            <p className="text-white/80 text-sm mt-1">Total Plans</p>
          </CardContent>
        </Card>
        <Card className="gradient-green text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle2 className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">
              {plans.filter(p => p.is_active).length}
            </div>
            <p className="text-white/80 text-sm mt-1">Active Plans</p>
          </CardContent>
        </Card>
        <Card className="gradient-orange text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">
              ${plans.length > 0 ? Math.min(...plans.map(p => p.monthly_price)) : 0}
            </div>
            <p className="text-white/80 text-sm mt-1">Starting From (Monthly)</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      {loading ? (
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : plans.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-brand-blue mb-2">No billing plans yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Create your first billing plan to start onboarding schools
            </p>
            <Button
              onClick={() => {
                setEditingPlan(null);
                setShowFormModal(true);
              }}
              className="gradient-blue"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-gray-200">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-bold text-brand-blue">Plan Name</TableHead>
                    <TableHead className="font-bold text-brand-blue">Description</TableHead>
                    <TableHead className="font-bold text-brand-blue">Monthly</TableHead>
                    <TableHead className="font-bold text-brand-blue">Quarterly</TableHead>
                    <TableHead className="font-bold text-brand-blue">Yearly</TableHead>
                    <TableHead className="font-bold text-brand-blue">Max Students</TableHead>
                    <TableHead className="font-bold text-brand-blue">Status</TableHead>
                    <TableHead className="font-bold text-brand-blue text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-[#57A3CC]" />
                          <span>{plan.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                        {plan.description || "—"}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        ${plan.monthly_price}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        ${plan.quarterly_price}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        ${plan.yearly_price}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {plan.max_students ? plan.max_students.toLocaleString() : "Unlimited"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            plan.is_active
                              ? "bg-green-500 hover:bg-green-600 text-white border-0"
                              : "bg-gray-500 hover:bg-gray-600 text-white border-0"
                          }
                        >
                          {plan.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingPlan(plan);
                              setShowFormModal(true);
                            }}
                            className="gradient-orange text-white hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedPlan(plan);
                              setShowDeleteDialog(true);
                            }}
                            className="gradient-red text-white hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Billing Plan?"
        description={
          selectedPlan
            ? `Are you sure you want to delete "${selectedPlan.name}"? This action cannot be undone and may affect schools using this plan.`
            : ""
        }
        confirmText="Delete"
        onConfirm={handleDeletePlan}
        variant="destructive"
        loading={isProcessing}
      />

      {/* Plan Form Modal */}
      <BillingPlanFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingPlan(null);
        }}
        onSubmit={editingPlan ? handleUpdatePlan : handleCreatePlan}
        editingPlan={editingPlan}
      />
    </div>
  );
}
