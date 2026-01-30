'use client'

import { useStudentDashboard } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, Download, AlertCircle, CheckCircle2 } from 'lucide-react'

export function FinancialCenter() {
  const { dashboardData, isLoading, error } = useStudentDashboard()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-gray-200 rounded" />
            <div className="h-16 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !dashboardData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center text-red-600">
          Failed to load financial data
        </CardContent>
      </Card>
    )
  }

  const { fee_status } = dashboardData

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Financial Center
        </CardTitle>
        <p className="text-sm text-gray-500">
          Fee status and payment information
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Total Due */}
          <div className={`p-4 rounded-lg ${fee_status.total_due === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-sm text-gray-600 mb-1">Total Due</p>
            <p className={`text-3xl font-bold ${fee_status.total_due === 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${fee_status.total_due.toFixed(2)}
            </p>
            {fee_status.total_due === 0 ? (
              <div className="flex items-center gap-1 mt-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">All fees paid</span>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mt-1">
                {fee_status.unpaid_invoices} invoice{fee_status.unpaid_invoices !== 1 ? 's' : ''} pending
              </p>
            )}
          </div>

          {/* Overdue Amount */}
          {fee_status.overdue_amount > 0 && (
            <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
              <p className="text-sm text-gray-600 mb-1">Overdue Amount</p>
              <p className="text-3xl font-bold text-orange-600">
                ${fee_status.overdue_amount.toFixed(2)}
              </p>
              <div className="flex items-center gap-1 mt-2 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Requires immediate attention</span>
              </div>
            </div>
          )}

          {/* Next Due */}
          {fee_status.next_due_date && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Next Payment Due</p>
              <p className="text-2xl font-bold text-blue-600">
                ${fee_status.next_due_amount?.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Due on {new Date(fee_status.next_due_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Payment Actions */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">Quick Actions</h4>
              <p className="text-sm text-gray-500">Manage fee payments and invoices</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                View Invoices
              </Button>
              {fee_status.total_due > 0 && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pay Now
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Payment History Link */}
        <div className="pt-4 border-t">
          <Button variant="link" className="text-blue-600 p-0">
            View complete payment history →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
