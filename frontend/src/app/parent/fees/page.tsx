'use client'

import { useState, useMemo, useRef } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { usePaymentHistory } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Download,
  Receipt,
  Filter,
  Calendar,
  Printer
} from 'lucide-react'
import { StudentSelector } from '@/components/parent/StudentSelector'
import { format, parseISO } from 'date-fns'

const MONTHS = [
  { value: 0, label: 'All Months' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

export default function ParentFeesPage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = All months
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  const { selectedStudent, students, isLoading: studentsLoading } = useParentDashboard()
  const { fees, isLoading: feesLoading, error } = usePaymentHistory()

  const student = students.find(s => s.id === selectedStudent)
  const isLoading = studentsLoading || feesLoading

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Categorize fees
  const categorizedFees = useMemo(() => {
    if (!fees || fees.length === 0) {
      return { paid: [], pending: [], overdue: [] }
    }

    const now = new Date()
    
    // Filter by month if selected
    let filtered = fees
    if (selectedMonth > 0) {
      filtered = fees.filter((f: any) => {
        const dueDate = f.due_date ? new Date(f.due_date) : now
        return dueDate.getMonth() + 1 === selectedMonth && dueDate.getFullYear() === selectedYear
      })
    }

    const paid = filtered.filter((f: any) => 
      f.status === 'paid' || f.balance <= 0
    )
    const pending = filtered.filter((f: any) => 
      f.status !== 'paid' && f.balance > 0 && (!f.due_date || new Date(f.due_date) >= now)
    )
    const overdue = filtered.filter((f: any) => 
      f.status !== 'paid' && f.balance > 0 && f.due_date && new Date(f.due_date) < now
    )

    return { paid, pending, overdue }
  }, [fees, selectedMonth, selectedYear])

  // Stats
  const stats = useMemo(() => {
    const paidAmount = categorizedFees.paid.reduce((sum: number, f: any) => sum + (f.final_amount || 0), 0)
    const pendingAmount = categorizedFees.pending.reduce((sum: number, f: any) => sum + (f.balance || 0), 0)
    const overdueAmount = categorizedFees.overdue.reduce((sum: number, f: any) => sum + (f.balance || 0), 0)

    return { 
      paidAmount, 
      pendingAmount, 
      overdueAmount,
      paidCount: categorizedFees.paid.length,
      pendingCount: categorizedFees.pending.length,
      overdueCount: categorizedFees.overdue.length
    }
  }, [categorizedFees])

  // Download challan as PDF
  const downloadChallan = (fee: any) => {
    const challanContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Challan - ${fee.fee_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #333; }
          .header p { margin: 5px 0; color: #666; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .detail-box { padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .detail-box label { font-size: 12px; color: #666; display: block; }
          .detail-box span { font-size: 16px; font-weight: bold; color: #333; }
          .amount-section { background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .amount-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #c8e6c9; }
          .amount-row:last-child { border-bottom: none; font-size: 18px; font-weight: bold; }
          .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
          .status.paid { background: #c8e6c9; color: #2e7d32; }
          .status.pending { background: #fff3e0; color: #ef6c00; }
          .status.overdue { background: #ffebee; color: #c62828; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #1976d2; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
          @media print { .print-btn { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FEE CHALLAN</h1>
          <p>Academic Year: ${fee.academic_year || currentDate.getFullYear()}</p>
          <p>Generated on: ${format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
        
        <div class="details">
          <div class="detail-box">
            <label>Student Name</label>
            <span>${student?.first_name || ''} ${student?.last_name || ''}</span>
          </div>
          <div class="detail-box">
            <label>Student ID</label>
            <span>${student?.student_number || 'N/A'}</span>
          </div>
          <div class="detail-box">
            <label>Class/Section</label>
            <span>${student?.grade_level || ''} - ${student?.section || ''}</span>
          </div>
          <div class="detail-box">
            <label>Fee Type</label>
            <span>${fee.fee_name || fee.category || 'Fee'}</span>
          </div>
          <div class="detail-box">
            <label>Due Date</label>
            <span>${fee.due_date ? format(parseISO(fee.due_date), 'MMMM d, yyyy') : 'N/A'}</span>
          </div>
          <div class="detail-box">
            <label>Status</label>
            <span class="status ${fee.status === 'paid' || fee.balance <= 0 ? 'paid' : fee.due_date && new Date(fee.due_date) < new Date() ? 'overdue' : 'pending'}">
              ${fee.status === 'paid' || fee.balance <= 0 ? 'PAID' : fee.due_date && new Date(fee.due_date) < new Date() ? 'OVERDUE' : 'PENDING'}
            </span>
          </div>
        </div>

        <div class="amount-section">
          <div class="amount-row">
            <span>Base Amount</span>
            <span>${formatCurrency(fee.base_amount || fee.final_amount || 0)}</span>
          </div>
          ${fee.final_amount !== fee.base_amount ? `
          <div class="amount-row">
            <span>Final Amount</span>
            <span>${formatCurrency(fee.final_amount || 0)}</span>
          </div>
          ` : ''}
          <div class="amount-row">
            <span>Amount Paid</span>
            <span>${formatCurrency(fee.amount_paid || 0)}</span>
          </div>
          <div class="amount-row">
            <span>Balance Due</span>
            <span>${formatCurrency(fee.balance || 0)}</span>
          </div>
        </div>

        ${fee.payments && fee.payments.length > 0 ? `
        <h3>Payment History</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Amount</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Method</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Reference</th>
            </tr>
          </thead>
          <tbody>
            ${fee.payments.map((p: any) => `
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${p.payment_date ? format(parseISO(p.payment_date), 'MMM d, yyyy') : 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrency(p.amount || 0)}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${p.payment_method || 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${p.payment_reference || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated challan.</p>
          <p>For any queries, please contact the school accounts department.</p>
        </div>

        <button class="print-btn" onclick="window.print()">Print Challan</button>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(challanContent)
      printWindow.document.close()
    }
  }

  const renderFeeRow = (fee: any, showStatus = true) => {
    const isPaid = fee.status === 'paid' || fee.balance <= 0
    const isOverdue = !isPaid && fee.due_date && new Date(fee.due_date) < new Date()

    return (
      <div 
        key={fee.id} 
        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-2 rounded-lg ${
            isPaid ? 'bg-green-100 dark:bg-green-900/30' :
            isOverdue ? 'bg-red-100 dark:bg-red-900/30' :
            'bg-yellow-100 dark:bg-yellow-900/30'
          }`}>
            <Receipt className={`h-5 w-5 ${
              isPaid ? 'text-green-600' :
              isOverdue ? 'text-red-600' :
              'text-yellow-600'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold truncate">{fee.fee_name || fee.category || 'Fee'}</h4>
              {showStatus && (
                <Badge 
                  variant={isPaid ? 'default' : isOverdue ? 'destructive' : 'secondary'}
                  className={isPaid ? 'bg-green-500' : ''}
                >
                  {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>Amount: {formatCurrency(fee.final_amount || 0)}</span>
              {fee.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due: {format(parseISO(fee.due_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
            {fee.amount_paid > 0 && !isPaid && (
              <p className="text-xs text-green-600 mt-1">
                Paid: {formatCurrency(fee.amount_paid)} • Balance: {formatCurrency(fee.balance)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-lg font-bold ${
              isPaid ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {formatCurrency(isPaid ? fee.final_amount : fee.balance)}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPaid ? 'Total Paid' : 'Balance'}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => downloadChallan(fee)}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            Challan
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading fees</h3>
              <p className="text-red-700 dark:text-red-300">{error?.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            Fees
          </h1>
          <p className="text-muted-foreground mt-1">
            {student ? `${student.first_name} ${student.last_name}'s fee status` : 'View fee status and payment history'}
          </p>
        </div>
        <StudentSelector />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-fit mx-auto mb-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidAmount)}</p>
            <p className="text-sm text-muted-foreground">Total Paid ({stats.paidCount})</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full w-fit mx-auto mb-3">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.pendingAmount)}</p>
            <p className="text-sm text-muted-foreground">Pending ({stats.pendingCount})</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto mb-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdueAmount)}</p>
            <p className="text-sm text-muted-foreground">Overdue ({stats.overdueCount})</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs with Month Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fee Details & Payment History</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={`${selectedMonth}-${selectedYear}`} 
                onValueChange={(value) => {
                  const [month, year] = value.split('-')
                  setSelectedMonth(parseInt(month))
                  setSelectedYear(parseInt(year))
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(month => (
                    <SelectItem key={month.value} value={`${month.value}-${selectedYear}`}>
                      {month.label} {month.value > 0 ? selectedYear : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="paid" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Paid ({stats.paidCount})
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending ({stats.pendingCount})
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Overdue ({stats.overdueCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paid">
              {categorizedFees.paid.length > 0 ? (
                <div className="space-y-3">
                  {categorizedFees.paid
                    .sort((a: any, b: any) => new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime())
                    .map((fee: any) => renderFeeRow(fee, false))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No paid fees</p>
                  <p className="text-sm">Paid fees will appear here</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending">
              {categorizedFees.pending.length > 0 ? (
                <div className="space-y-3">
                  {categorizedFees.pending
                    .sort((a: any, b: any) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
                    .map((fee: any) => renderFeeRow(fee, false))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg text-green-600">No pending fees!</p>
                  <p className="text-sm">All fees are up to date</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="overdue">
              {categorizedFees.overdue.length > 0 ? (
                <div className="space-y-3">
                  {categorizedFees.overdue
                    .sort((a: any, b: any) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
                    .map((fee: any) => renderFeeRow(fee, false))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg text-green-600">No overdue fees!</p>
                  <p className="text-sm">Great job staying on track with payments</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Payment Information */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Payment Information
          </h3>
          <ul className="text-blue-800 dark:text-blue-300 text-sm space-y-2 list-disc list-inside">
            <li>Pay fees before the due date to avoid late charges</li>
            <li>Download and print the challan for offline payment</li>
            <li>Contact the accounts department for payment queries</li>
            <li>Keep payment receipts for your records</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
