'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, BookOpen, Loader2 } from "lucide-react"
import { getAuthToken } from '@/lib/api/schools'
import { API_URL } from '@/config/api'

interface LibraryStats {
  total_books: number;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  active_loans: number;
  overdue_loans: number;
  total_fines_collected: number;
  pending_fines: number;
}

export default function AdminLibraryPage() {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getAuthToken();
        const response = await fetch(`${API_URL}/library/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        } else {
          setError(data.error || 'Failed to load stats');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#022172] dark:text-white">Library Overview</h1>
        <p className="text-gray-500 mt-1">High-level library insights</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Library Management Moved</AlertTitle>
        <AlertDescription>
          Full library management capabilities (Adding books, issuing loans, etc.) have been moved to the <strong>Librarian Dashboard</strong>.
          You can manage Librarians in the Staff section.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#57A3CC]" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Total Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#022172] dark:text-white">{stats?.total_books || 0} Books</div>
              <p className="text-xs text-gray-500 mt-1">{stats?.total_copies || 0} total copies</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Current Circulation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#022172] dark:text-white">{stats?.active_loans || 0} Issued</div>
              {(stats?.overdue_loans || 0) > 0 && (
                <p className="text-xs text-red-600 mt-1">{stats?.overdue_loans} overdue</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Financials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#022172] dark:text-white">${stats?.total_fines_collected?.toFixed(2) || '0.00'} Collected</div>
              {(stats?.pending_fines || 0) > 0 && (
                <p className="text-xs text-amber-600 mt-1">${stats?.pending_fines?.toFixed(2)} pending</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
