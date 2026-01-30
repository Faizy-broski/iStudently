"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Search, 
  Filter, 
  Download, 
  FileText, 
  DollarSign, 
  Calendar, 
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingUp,
  Building2,
  Plus,
  Edit,
  Trash2,
  Package,
  Users
} from "lucide-react";
import ConfirmationDialog from "@/components/super-admin/ConfirmationDialog";
import BillingFormModal from "@/components/super-admin/BillingFormModal";
import BillingPlanFormModal from "@/components/super-admin/BillingPlanFormModal";
import { PaginationWrapper } from "@/components/ui/pagination";
import { billingRecordsApi, billingPlansApi, BillingRecord, BillingPlan } from "@/lib/api/billing";
import { useBilling } from "@/hooks/useBilling";

export default function BillingStatusPage() {
  // Use SWR hook for efficient data fetching
  const { records: billingRecords, plans: billingPlans, stats, loading, error, refreshBilling, mutate, isValidating } = useBilling();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid" | "overdue" | "pending">("all");
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeletePlanDialog, setShowDeletePlanDialog] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPlanFormModal, setShowPlanFormModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Show 10 billing records per page

  // Filter records based on search and status
  const filteredRecords = useMemo(() => {
    let filtered = billingRecords;

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(record => record.payment_status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record =>
        (record.school_name ?? "").toLowerCase().includes(query) ||
        record.invoice_number.toLowerCase().includes(query) ||
        (record.subscription_plan ?? "").toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, statusFilter, billingRecords]);

  // Calculate paginated records
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedRecords = filteredRecords.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredRecords.length]);

  const handleMarkAsPaid = async () => {
    if (!selectedRecord) return;

    try {
      setIsProcessing(true);
      console.log('💰 Marking as paid:', selectedRecord.id);
      
      await billingRecordsApi.markAsPaid(selectedRecord.id);

      console.log('✅ Marked as paid successfully');

      // Refresh SWR data
      mutate();

      toast.success("Payment status updated", {
        description: `${selectedRecord.school_name} marked as paid`
      });
      setShowPaymentDialog(false);
      setSelectedRecord(null);
    } catch (error: any) {
      console.error('❌ Mark as paid failed:', error);
      toast.error("Error updating payment status", {
        description: error.message || 'An unexpected error occurred'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBilling = async (data: Omit<BillingRecord, "id" | "school_name" | "subscription_plan" | "invoice_number" | "created_at">) => {
    try {
      await billingRecordsApi.create(data);
      // Refresh SWR data
      mutate();
      toast.success("Billing record created successfully");
      setShowFormModal(false);
    } catch (error: any) {
      toast.error("Error creating billing record", {
        description: error.message
      });
    }
  };

  const handleUpdateBilling = async (data: Omit<BillingRecord, "id" | "school_name" | "subscription_plan" | "invoice_number" | "created_at">) => {
    if (!editingRecord) return;

    try {
      // Remove fields that are not in the billing_records table
      const { school_name, subscription_plan, ...updateData } = data as any;
      
      await billingRecordsApi.update(editingRecord.id, updateData);

      // Refresh SWR data
      mutate();

      toast.success("Billing record updated successfully");
      setShowFormModal(false);
      setEditingRecord(null);
    } catch (error: any) {
      toast.error("Error updating billing record", {
        description: error.message
      });
    }
  };

  const handleDeleteBilling = async () => {
    if (!selectedRecord) return;

    try {
      setIsProcessing(true);
      await billingRecordsApi.delete(selectedRecord.id);

      // Refresh SWR data
      mutate();

      toast.success("Billing record deleted", {
        description: `Billing for ${selectedRecord.school_name} has been removed`
      });
      setShowDeleteDialog(false);
      setSelectedRecord(null);
    } catch (error: any) {
      toast.error("Error deleting billing record", {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePlan = async (data: Omit<BillingPlan, "id" | "created_at">) => {
    try {
      await billingPlansApi.create(data);
      // Refresh SWR data
      mutate();
      toast.success("Billing plan created successfully");
      setShowPlanFormModal(false);
    } catch (error: any) {
      toast.error("Error creating billing plan", {
        description: error.message
      });
    }
  };

  const handleUpdatePlan = async (data: Omit<BillingPlan, "id" | "created_at">) => {
    if (!editingPlan) return;

    try {
      await billingPlansApi.update(editingPlan.id, data);

      // Refresh SWR data
      mutate();

      toast.success("Billing plan updated successfully");
      setShowPlanFormModal(false);
      setEditingPlan(null);
    } catch (error: any) {
      toast.error("Error updating billing plan", {
        description: error.message
      });
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;

    try {
      setIsProcessing(true);
      await billingPlansApi.delete(selectedPlan.id);

      // Refresh SWR data
      mutate();

      toast.success("Billing plan deleted", {
        description: `${selectedPlan.name} plan has been removed`
      });
      setShowDeletePlanDialog(false);
      setSelectedPlan(null);
    } catch (error: any) {
      toast.error("Error deleting billing plan", {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateInvoice = (record: BillingRecord) => {
    try {
      // Create HTML content for the invoice
      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice ${record.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #022172; padding-bottom: 20px; }
            .logo { font-size: 32px; font-weight: bold; color: #022172; }
            .invoice-details { margin: 30px 0; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .detail-item { margin-bottom: 10px; }
            .label { font-weight: bold; color: #666; }
            .value { color: #022172; font-weight: 600; }
            .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            .table th { background: #022172; color: white; padding: 12px; text-align: left; }
            .table td { padding: 12px; border-bottom: 1px solid #ddd; }
            .total { text-align: right; font-size: 24px; font-weight: bold; color: #022172; margin-top: 20px; }
            .footer { margin-top: 50px; text-align: center; color: #666; border-top: 2px solid #ddd; padding-top: 20px; }
            .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
            .status.paid { background: #10b981; color: white; }
            .status.unpaid { background: #6b7280; color: white; }
            .status.overdue { background: #ef4444; color: white; }
            .status.pending { background: #eab308; color: white; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">STUDENTLY</div>
            <p style="margin: 5px 0; color: #666;">School Management System</p>
          </div>
          
          <div class="invoice-details">
            <h2 style="color: #022172; margin-bottom: 20px;">INVOICE</h2>
            <div class="details-grid">
              <div>
                <div class="detail-item">
                  <span class="label">Invoice Number:</span><br>
                  <span class="value">${record.invoice_number}</span>
                </div>
                <div class="detail-item">
                  <span class="label">School:</span><br>
                  <span class="value">${record.school_name}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Status:</span><br>
                  <span class="status ${record.payment_status}">${record.payment_status.toUpperCase()}</span>
                </div>
              </div>
              <div style="text-align: right;">
                <div class="detail-item">
                  <span class="label">Issue Date:</span><br>
                  <span class="value">${new Date(record.start_date || record.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Due Date:</span><br>
                  <span class="value">${new Date(record.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                ${record.payment_date ? `
                <div class="detail-item">
                  <span class="label">Payment Date:</span><br>
                  <span class="value">${new Date(record.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                ` : ''}
              </div>
            </div>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Billing Cycle</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>${record.subscription_plan || 'Subscription'} Plan</strong><br>
                  <span style="color: #666; font-size: 14px;">School Management System Subscription</span>
                </td>
                <td>${record.billing_cycle}</td>
                <td style="text-align: right; font-weight: bold;">$${record.amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="total">
            Total Amount: $${record.amount.toLocaleString()}
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p style="font-size: 12px; color: #999;">This is a computer-generated invoice. For any queries, please contact support@studently.com</p>
          </div>
        </body>
        </html>
      `;

      // Create a new window and print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for content to load then print
        setTimeout(() => {
          printWindow.print();
        }, 250);
        
        toast.success("Invoice generated", {
          description: `Invoice ${record.invoice_number} for ${record.school_name} is ready to print/save as PDF`
        });
      } else {
        toast.error("Failed to open print window", {
          description: "Please allow popups for this site"
        });
      }
    } catch (error: any) {
      toast.error("Error generating invoice", {
        description: error.message
      });
    }
  };

  const handleExportReport = () => {
    try {
      // Create CSV content
      const headers = ["School Name", "Invoice Number", "Plan", "Billing Cycle", "Amount", "Due Date", "Status", "Payment Date"];
      const csvContent = [
        headers.join(","),
        ...filteredRecords.map(record => [
          record.school_name,
          record.invoice_number,
          record.subscription_plan,
          record.billing_cycle,
          `$${record.amount}`,
          record.due_date,
          record.payment_status,
          record.payment_date || "N/A"
        ].join(","))
      ].join("\n");

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `billing-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast.success("Report exported successfully");
    } catch (error: any) {
      toast.error("Error exporting report", {
        description: error.message
      });
    }
  };

  const getStatusBadge = (status: BillingRecord["payment_status"]) => {
    const statusConfig = {
      paid: { label: "Paid", className: "bg-green-500 hover:bg-green-600 text-white border-0" },
      unpaid: { label: "Unpaid", className: "bg-gray-500 hover:bg-gray-600 text-white border-0" },
      overdue: { label: "Overdue", className: "bg-red-500 hover:bg-red-600 text-white border-0" },
      pending: { label: "Pending", className: "bg-yellow-500 hover:bg-yellow-600 text-white border-0" },
    };

    const config = statusConfig[status];
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: BillingRecord["payment_status"]) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "overdue":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <DollarSign className="h-5 w-5 text-gray-500" />;
    }
  };

  const statsCalculated = {
    totalRevenue: billingRecords.reduce((sum, r) => r.payment_status === "paid" ? sum + r.amount : sum, 0),
    pendingRevenue: billingRecords.reduce((sum, r) => r.payment_status !== "paid" ? sum + r.amount : sum, 0),
    paidCount: stats.paid,
    overdueCount: stats.overdue,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">
            Billing & Payments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage plans, subscriptions, invoices, and payment status
          </p>
        </div>
        <Button
          onClick={refreshBilling}
          variant="outline"
          disabled={isValidating}
          className="gap-2 hover:gradient-blue hover:text-white transition-all duration-300"
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="gradient-green text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">${statsCalculated.totalRevenue.toLocaleString()}</div>
            <p className="text-white/80 text-sm mt-1">Total Revenue (Paid)</p>
          </CardContent>
        </Card>
        <Card className="gradient-orange text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">${statsCalculated.pendingRevenue.toLocaleString()}</div>
            <p className="text-white/80 text-sm mt-1">Pending Revenue</p>
          </CardContent>
        </Card>
        <Card className="gradient-blue text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle2 className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">{statsCalculated.paidCount}</div>
            <p className="text-white/80 text-sm mt-1">Paid Invoices</p>
          </CardContent>
        </Card>
        <Card className="gradient-red text-white hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="h-8 w-8 text-white/80" />
            </div>
            <div className="text-3xl font-bold">{statsCalculated.overdueCount}</div>
            <p className="text-white/80 text-sm mt-1">Overdue Payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Billing Records and Plans */}
      <Tabs defaultValue="billing-records" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-14 bg-gradient-to-r from-blue-50 to-indigo-50 p-2 border border-blue-100 shadow-md">
          <TabsTrigger 
            value="billing-records" 
            className="gap-2 h-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#57A3CC] data-[state=active]:to-[#022172] data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 font-semibold hover:bg-white/50"
          >
            <DollarSign className="h-5 w-5" />
            Billing Records
          </TabsTrigger>
          <TabsTrigger 
            value="plans" 
            className="gap-2 h-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#21C97B] data-[state=active]:to-[#16A34A] data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 font-semibold hover:bg-white/50"
          >
            <Package className="h-5 w-5" />
            Billing Plans
          </TabsTrigger>
        </TabsList>

        {/* Billing Records Tab */}
        <TabsContent value="billing-records" className="space-y-4 mt-6">
          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setEditingRecord(null);
                setShowFormModal(true);
              }}
              className="gap-2 gradient-blue hover:shadow-lg transition-all duration-300"
            >
              <Plus className="h-4 w-4" />
              Add Billing
            </Button>
            <Button
              onClick={handleExportReport}
              variant="outline"
              className="gap-2 hover-gradient-teal transition-all duration-300"
            >
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>

          {/* Filters Bar */}
          <Card className="border-l-4 border-l-[#57A3CC] shadow-md">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#57A3CC]" />
                    <Input
                      placeholder="Search by school name, invoice number, or plan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC] h-11"
                    />
                  </div>
                </div>
                <div>
                  <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                    <SelectTrigger className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC] h-11">
                      <Filter className="h-5 w-5 mr-2 text-[#57A3CC]" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid Only</SelectItem>
                      <SelectItem value="unpaid">Unpaid Only</SelectItem>
                      <SelectItem value="overdue">Overdue Only</SelectItem>
                      <SelectItem value="pending">Pending Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Records Table */}
          {loading ? (
            <Card className="border-gray-200">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredRecords.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-brand-blue mb-2">No billing records found</h3>
                <p className="text-gray-500 text-sm">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "No billing records available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-gray-200">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-bold text-brand-blue">School</TableHead>
                        <TableHead className="font-bold text-brand-blue">Invoice</TableHead>
                        <TableHead className="font-bold text-brand-blue">Plan</TableHead>
                        <TableHead className="font-bold text-brand-blue">Billing Cycle</TableHead>
                        <TableHead className="font-bold text-brand-blue">Amount</TableHead>
                        <TableHead className="font-bold text-brand-blue">Due Date</TableHead>
                        <TableHead className="font-bold text-brand-blue">Status</TableHead>
                        <TableHead className="font-bold text-brand-blue">Payment Date</TableHead>
                        <TableHead className="font-bold text-brand-blue text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRecords.map((record) => (
                        <TableRow key={record.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(record.payment_status)}
                              <span>{record.school_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{record.invoice_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-[#57A3CC] text-[#57A3CC]">
                              {record.subscription_plan}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.billing_cycle}</TableCell>
                          <TableCell className="font-bold text-green-600">${record.amount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {new Date(record.due_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(record.payment_status)}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {record.payment_date
                              ? new Date(record.payment_date).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleGenerateInvoice(record)}
                                className="gradient-blue text-white hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Invoice
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEditingRecord(record);
                                  setShowFormModal(true);
                                }}
                                className="gradient-orange text-white hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              {record.payment_status !== "paid" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRecord(record);
                                      setShowPaymentDialog(true);
                                    }}
                                    className="gradient-green text-white hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                                  >
                                    Mark Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRecord(record);
                                      setShowDeleteDialog(true);
                                    }}
                                    className="gradient-red text-white hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
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

          {/* Pagination Controls */}
          {!loading && filteredRecords.length > 0 && (
            <PaginationWrapper
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredRecords.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              variant="gradient"
            />
          )}
        </TabsContent>

        {/* Billing Plans Tab */}
        <TabsContent value="plans" className="space-y-4 mt-6">
          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setEditingPlan(null);
                setShowPlanFormModal(true);
              }}
              className="gap-2 gradient-blue hover:shadow-lg transition-all duration-300"
            >
              <Plus className="h-4 w-4" />
              Create Plan
            </Button>
          </div>

          {/* Billing Plans Table */}
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
          ) : billingPlans.length === 0 ? (
            <Card className="border-2 border-dashed border-gray-300">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-brand-blue mb-2">No billing plans found</h3>
                <p className="text-gray-500 text-sm">
                  Create your first billing plan to get started
                </p>
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
                      {billingPlans.map((plan) => (
                        <TableRow key={plan.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-5 w-5 text-[#57A3CC]" />
                              <span>{plan.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                            {plan.description}
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
                              {plan.max_students}
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
                                  setShowPlanFormModal(true);
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
                                  setShowDeletePlanDialog(true);
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
        </TabsContent>
      </Tabs>

      {/* Payment Confirmation Dialog */}
      <ConfirmationDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        title="Mark as Paid?"
        description={
          selectedRecord
            ? `Are you sure you want to mark invoice ${selectedRecord.invoice_number} for "${selectedRecord.school_name}" as paid? Amount: $${selectedRecord.amount}`
            : ""
        }
        confirmText="Mark as Paid"
        onConfirm={handleMarkAsPaid}
        variant="default"
        loading={isProcessing}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Billing Record?"
        description={
          selectedRecord
            ? `Are you sure you want to delete the billing record for "${selectedRecord.school_name}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        onConfirm={handleDeleteBilling}
        variant="destructive"
        loading={isProcessing}
      />

      {/* Billing Form Modal */}
      <BillingFormModal
        open={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingRecord(null);
        }}
        onSubmit={editingRecord ? handleUpdateBilling : handleCreateBilling}
        editingRecord={editingRecord}
      />

      {/* Billing Plan Form Modal */}
      <BillingPlanFormModal
        open={showPlanFormModal}
        onClose={() => {
          setShowPlanFormModal(false);
          setEditingPlan(null);
        }}
        onSubmit={editingPlan ? handleUpdatePlan : handleCreatePlan}
        editingPlan={editingPlan}
      />

      {/* Delete Plan Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeletePlanDialog}
        onOpenChange={setShowDeletePlanDialog}
        title="Delete Billing Plan?"
        description={
          selectedPlan
            ? `Are you sure you want to delete the "${selectedPlan.name}" plan? Schools currently using this plan will have their billing_plan_id set to null. This action cannot be undone.`
            : ""
        }
        confirmText="Delete"
        onConfirm={handleDeletePlan}
        variant="destructive"
        loading={isProcessing}
      />
    </div>
  );
}
