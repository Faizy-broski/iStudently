'use client'

import { useState } from 'react'
import { usePaymentHistory } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  DollarSign,
  Download,
  Receipt,
  CreditCard,
  Banknote,
  Building2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText
} from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import { FeePayment, FeeWithPayments } from '@/lib/api/parent-dashboard'

export function PaymentHistory() {
  const { fees, isLoading, error, refresh } = usePaymentHistory()
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusBadge = (status: string, balance: number, dueDate: string) => {
    const isOverdue = balance > 0 && new Date(dueDate) < new Date()
    
    if (status === 'paid' || balance === 0) {
      return (
        <Badge className="bg-green-100 text-green-700 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Paid
        </Badge>
      )
    }
    if (status === 'overdue' || isOverdue) {
      return (
        <Badge className="bg-red-100 text-red-700 gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>
      )
    }
    if (status === 'partial') {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 gap-1">
          <Clock className="h-3 w-3" />
          Partial
        </Badge>
      )
    }
    return (
      <Badge className="bg-gray-100 text-gray-700 gap-1">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    )
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'card':
      case 'credit_card':
      case 'debit_card':
        return <CreditCard className="h-4 w-4" />
      case 'cash':
        return <Banknote className="h-4 w-4" />
      case 'bank_transfer':
      case 'transfer':
        return <Building2 className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const downloadReceipt = async (fee: FeeWithPayments, payment: FeePayment) => {
    setDownloadingReceipt(payment.id)
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const margin = 20
      let y = margin

      // Header
      pdf.setFontSize(24)
      pdf.setFont('helvetica', 'bold')
      pdf.text('PAYMENT RECEIPT', pdf.internal.pageSize.width / 2, y, { align: 'center' })
      y += 15

      // Receipt number
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Receipt No: ${payment.id.slice(0, 8).toUpperCase()}`, pdf.internal.pageSize.width / 2, y, { align: 'center' })
      y += 15

      // Divider
      pdf.setLineWidth(0.5)
      pdf.line(margin, y, pdf.internal.pageSize.width - margin, y)
      y += 10

      // Fee Details
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Fee Details', margin, y)
      y += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text(`Fee Name: ${fee.fee_name}`, margin, y)
      y += 6
      pdf.text(`Category: ${fee.category}`, margin, y)
      y += 6
      pdf.text(`Academic Year: ${fee.academic_year}`, margin, y)
      y += 12

      // Payment Details
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Payment Details', margin, y)
      y += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text(`Amount Paid: ${formatCurrency(payment.amount)}`, margin, y)
      y += 6
      pdf.text(`Payment Method: ${payment.payment_method.replace('_', ' ').toUpperCase()}`, margin, y)
      y += 6
      pdf.text(`Payment Date: ${format(new Date(payment.payment_date), 'PPP')}`, margin, y)
      y += 6
      if (payment.payment_reference) {
        pdf.text(`Reference: ${payment.payment_reference}`, margin, y)
        y += 6
      }
      if (payment.received_by) {
        pdf.text(`Received By: ${payment.received_by}`, margin, y)
        y += 6
      }
      y += 10

      // Summary Box
      pdf.setFillColor(240, 240, 240)
      pdf.rect(margin, y, pdf.internal.pageSize.width - 2 * margin, 25, 'F')
      y += 8

      pdf.setFont('helvetica', 'bold')
      pdf.text('Total Fee Amount:', margin + 5, y)
      pdf.text(formatCurrency(fee.final_amount), pdf.internal.pageSize.width - margin - 5, y, { align: 'right' })
      y += 8

      pdf.text('Total Paid:', margin + 5, y)
      pdf.text(formatCurrency(fee.amount_paid), pdf.internal.pageSize.width - margin - 5, y, { align: 'right' })
      y += 8

      pdf.setTextColor(fee.balance > 0 ? 220 : 0, fee.balance > 0 ? 0 : 150, 0)
      pdf.text('Balance:', margin + 5, y)
      pdf.text(formatCurrency(fee.balance), pdf.internal.pageSize.width - margin - 5, y, { align: 'right' })

      // Footer
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(9)
      pdf.text(
        'This is a computer-generated receipt.',
        pdf.internal.pageSize.width / 2,
        pdf.internal.pageSize.height - 15,
        { align: 'center' }
      )
      pdf.text(
        `Generated on ${format(new Date(), 'PPpp')}`,
        pdf.internal.pageSize.width / 2,
        pdf.internal.pageSize.height - 10,
        { align: 'center' }
      )

      pdf.save(`receipt-${payment.id.slice(0, 8)}.pdf`)
    } catch (err) {
      // Receipt generation failed - silent
    } finally {
      setDownloadingReceipt(null)
    }
  }

  // Calculate totals
  const totalDue = fees.reduce((sum, f) => sum + f.balance, 0)
  const totalPaid = fees.reduce((sum, f) => sum + f.amount_paid, 0)
  const overdueAmount = fees
    .filter(f => f.balance > 0 && new Date(f.due_date) < new Date())
    .reduce((sum, f) => sum + f.balance, 0)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Fee Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[200px] rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Fee Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-600 mb-4">Failed to load payment history</p>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Fee Payment History
            </CardTitle>
            <CardDescription>
              View all fees and download payment receipts
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
                  <p className="text-xs text-green-600">Total Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalDue)}</p>
                  <p className="text-xs text-blue-600">Balance Due</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${overdueAmount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full ${overdueAmount > 0 ? 'bg-red-100' : 'bg-gray-100'} flex items-center justify-center`}>
                  <AlertTriangle className={`h-5 w-5 ${overdueAmount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${overdueAmount > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                    {formatCurrency(overdueAmount)}
                  </p>
                  <p className={`text-xs ${overdueAmount > 0 ? 'text-red-600' : 'text-gray-500'}`}>Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fee List */}
        {fees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No fee records found</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {fees.map((fee) => (
              <AccordionItem 
                key={fee.id} 
                value={fee.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-semibold text-left">{fee.fee_name}</p>
                        <p className="text-sm text-muted-foreground text-left">
                          {fee.category} • {fee.academic_year}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(fee.final_amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(fee.due_date), 'PP')}
                        </p>
                      </div>
                      {getStatusBadge(fee.status, fee.balance, fee.due_date)}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    {/* Fee Summary */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Base Amount</p>
                        <p className="font-semibold">{formatCurrency(fee.base_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Final Amount</p>
                        <p className="font-semibold">{formatCurrency(fee.final_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Amount Paid</p>
                        <p className="font-semibold text-green-600">{formatCurrency(fee.amount_paid)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p className={`font-semibold ${fee.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(fee.balance)}
                        </p>
                      </div>
                    </div>

                    {/* Payment History */}
                    {fee.payments.length > 0 ? (
                      <div>
                        <h4 className="font-semibold mb-3 text-sm">Payment History</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Received By</TableHead>
                              <TableHead className="text-right">Receipt</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fee.payments.map((payment) => (
                              <TableRow key={payment.id}>
                                <TableCell>
                                  {format(new Date(payment.payment_date), 'PP')}
                                </TableCell>
                                <TableCell className="font-semibold text-green-600">
                                  {formatCurrency(payment.amount)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getPaymentMethodIcon(payment.payment_method)}
                                    <span className="capitalize">
                                      {payment.payment_method.replace('_', ' ')}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {payment.payment_reference || '-'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {payment.received_by || '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => downloadReceipt(fee, payment)}
                                    disabled={downloadingReceipt === payment.id}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    {downloadingReceipt === payment.id ? 'Generating...' : 'Receipt'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground bg-muted/30 rounded-lg">
                        <p>No payments recorded yet</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}
