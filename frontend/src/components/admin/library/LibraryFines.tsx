"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface FineStats {
  total_overdue_fines: number;
  total_condition_fines: number;
  unpaid_overdue_fines: number;
  paid_overdue_fines: number;
  overdue_fines_count: number;
  recent_fines: Array<{
    id: string;
    student_name: string;
    book_title: string;
    amount: number;
    type: "overdue" | "condition";
    paid: boolean;
    created_at: string;
  }>;
}

export function LibraryFines() {
  const { user } = useAuth();
  const [stats, setStats] = useState<FineStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFineStats = async () => {
      if (!user?.access_token) return;

      try {
        setIsLoading(true);
        const response = await fetch(
          `${API_URL}/library/fines/stats`,
          {
            headers: { Authorization: `Bearer ${user.access_token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStats(data.data);
          }
        }
      } catch (error) {
        console.error("Error loading fine stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFineStats();
  }, [user?.access_token]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Library Fines & Revenue
          </h1>
          <p className="text-muted-foreground mt-2">
            Track overdue fines and condition/damage fees collected
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Fines (Unpaid)</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${stats?.unpaid_overdue_fines.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Added to student accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Fines (Paid)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats?.paid_overdue_fines.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Collected from students
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Condition Fines Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${stats?.total_condition_fines.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Damage/poor condition fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${((stats?.paid_overdue_fines || 0) + (stats?.total_condition_fines || 0)).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total collected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Fines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Fines & Collections</CardTitle>
          <CardDescription>
            Latest overdue fines and condition fees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recent_fines && stats.recent_fines.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent_fines.map((fine) => (
                  <TableRow key={fine.id}>
                    <TableCell className="font-medium">{fine.student_name}</TableCell>
                    <TableCell>{fine.book_title}</TableCell>
                    <TableCell>
                      <Badge variant={fine.type === "overdue" ? "destructive" : "secondary"}>
                        {fine.type === "overdue" ? "Overdue" : "Condition"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">${fine.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      {fine.type === "overdue" ? (
                        fine.paid ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            Unpaid
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Collected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(fine.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No fines recorded yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
