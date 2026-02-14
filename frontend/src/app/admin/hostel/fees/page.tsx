"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRentalFees,
  generateRentalFees,
  recordFeePayment,
  getBuildings,
} from "@/lib/api/hostel";
import { HostelRentalFee, HostelBuilding } from "@/types";
import { DollarSign, Plus, CreditCard, Sparkles } from "lucide-react";

export default function FeesPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [fees, setFees] = useState<HostelRentalFee[]>([]);
  const [buildings, setBuildings] = useState<HostelBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  // Generate dialog
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [genFactor, setGenFactor] = useState(1);
  const [genBuildingId, setGenBuildingId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{
    fees_created: number;
    total_amount: number;
  } | null>(null);

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingFee, setPayingFee] = useState<HostelRentalFee | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId, filterStatus]);

  async function loadData() {
    try {
      setLoading(true);
      const [feesData, buildingsData] = await Promise.all([
        getRentalFees(schoolId, {
          status: filterStatus || undefined,
        }),
        getBuildings(schoolId),
      ]);
      setFees(feesData);
      setBuildings(buildingsData);
    } catch (err) {
      console.error("Failed to load fees:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!periodStart || !periodEnd) return;
    try {
      setGenerating(true);
      setGenResult(null);
      const result = await generateRentalFees({
        school_id: schoolId,
        period_start: periodStart,
        period_end: periodEnd,
        factor: genFactor,
        building_id: genBuildingId || undefined,
      });
      setGenResult(result);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to generate fees");
    } finally {
      setGenerating(false);
    }
  }

  function openPayment(fee: HostelRentalFee) {
    setPayingFee(fee);
    setPayAmount(fee.final_amount - fee.amount_paid);
    setPayNotes("");
    setPayDialogOpen(true);
  }

  async function handlePayment() {
    if (!payingFee || payAmount <= 0) return;
    try {
      setPaying(true);
      await recordFeePayment({
        fee_id: payingFee.id,
        amount: payAmount,
        notes: payNotes || undefined,
      });
      setPayDialogOpen(false);
      setPayingFee(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to record payment");
    } finally {
      setPaying(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    partial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    waived: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  };

  // Summary stats
  const totalPending = fees
    .filter((f) => f.status === "pending" || f.status === "partial")
    .reduce((s, f) => s + (f.final_amount - f.amount_paid), 0);
  const totalCollected = fees.reduce((s, f) => s + f.amount_paid, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rental Fees</h1>
          <p className="text-muted-foreground">
            Generate and track hostel rental fee payments
          </p>
        </div>
        {/* Generate button */}
        <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Fees
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle>Generate Rental Fees</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Period Start *</Label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period End *</Label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Factor</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={genFactor}
                    onChange={(e) => setGenFactor(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Multiplier for room price (1 = full, 0.5 = half)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Building</Label>
                  <Select
                    value={genBuildingId || "ALL"}
                    onValueChange={(v) =>
                      setGenBuildingId(v === "ALL" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Buildings</SelectItem>
                      {buildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {genResult && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-md text-sm">
                  <p>
                    ✅ Generated <strong>{genResult.fees_created}</strong>{" "}
                    fee(s) totalling{" "}
                    <strong>${genResult.total_amount.toFixed(2)}</strong>
                  </p>
                </div>
              )}
              <Button
                onClick={handleGenerate}
                disabled={generating || !periodStart || !periodEnd}
                className="w-full"
              >
                {generating ? "Generating..." : "Generate Fees"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Collected</p>
              <p className="text-xl font-bold">${totalCollected.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <CreditCard className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold">${totalPending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Plus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-xl font-bold">{fees.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Label className="text-sm">Status:</Label>
        <Select
          value={filterStatus || "ALL"}
          onValueChange={(v) => setFilterStatus(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="waived">Waived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {payingFee && (
            <div className="space-y-4 pt-2">
              <div className="text-sm">
                <p>
                  Student: <strong>{payingFee.student_name}</strong>
                </p>
                <p>
                  Room: <strong>{payingFee.room_number}</strong>
                </p>
                <p>
                  Outstanding:{" "}
                  <strong>
                    $
                    {(payingFee.final_amount - payingFee.amount_paid).toFixed(
                      2,
                    )}
                  </strong>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Optional..."
                />
              </div>
              <Button
                onClick={handlePayment}
                disabled={paying || payAmount <= 0}
                className="w-full"
              >
                {paying ? "Processing..." : "Record Payment"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : fees.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No fees</h3>
              <p className="text-muted-foreground">
                Generate rental fees for the current period
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Student</th>
                    <th className="text-left py-3 px-4 font-medium">Room</th>
                    <th className="text-left py-3 px-4 font-medium">Period</th>
                    <th className="text-left py-3 px-4 font-medium">Base</th>
                    <th className="text-left py-3 px-4 font-medium">Final</th>
                    <th className="text-left py-3 px-4 font-medium">Paid</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">
                        {f.student_name || f.student_id}
                      </td>
                      <td className="py-3 px-4">{f.room_number || "—"}</td>
                      <td className="py-3 px-4 text-xs">
                        {new Date(f.period_start).toLocaleDateString()} —{" "}
                        {new Date(f.period_end).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        ${Number(f.base_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        ${Number(f.final_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        ${Number(f.amount_paid).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[f.status] || ""}>
                          {f.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {f.status !== "paid" && f.status !== "waived" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPayment(f)}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Pay
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
