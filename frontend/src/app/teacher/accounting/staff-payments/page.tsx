'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { getStaffOwnSalaries, getStaffOwnPayments, type AccountingExpense } from '@/lib/api/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { DownloadCloud, Loader2, Search } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function TeacherStaffPaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data: salariesRes } = useSWR(
    'teacher-own-salaries-totals',
    () => getStaffOwnSalaries(),
    { revalidateOnFocus: false }
  )

  const { data: paymentsRes, isLoading: loadingPayments } = useSWR(
    'teacher-own-payments',
    () => getStaffOwnPayments(),
    { revalidateOnFocus: false }
  )

  const salaries = salariesRes?.data || []
  const payments = paymentsRes?.data || []

  // Filter logic
  const filteredPayments = payments.filter(p => 
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.comments?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculations
  const totalSalaries = salaries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const totalPayments = payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const balance = totalSalaries - totalPayments

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4 text-brand-teal">
        <div className="h-8 w-8 rounded bg-teal-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">💳</span>
        </div>
        <h1 className="text-3xl font-light">Staff Payments</h1>
      </div>

      <div className="flex justify-between items-center bg-gray-50 border-y py-2 px-1">
        <p className="text-sm font-semibold">
          {filteredPayments.length === 0 ? 'No payments were found.' : `${filteredPayments.length} payment(s) found.`}
        </p>
        <div className="flex gap-4 items-center">
          <Button variant="ghost" size="icon" onClick={handlePrint} title="Print/Export to PDF">
            <DownloadCloud className="h-5 w-5" />
          </Button>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-white"
            />
          </div>
        </div>
      </div>

      {filteredPayments.length > 0 && (
          <Card className="rounded-none shadow-sm border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-brand-blue font-bold">PAYMENT</TableHead>
                  <TableHead className="text-brand-blue font-bold">AMOUNT</TableHead>
                  <TableHead className="text-brand-blue font-bold">DATE</TableHead>
                  <TableHead className="text-brand-blue font-bold">COMMENT</TableHead>
                  <TableHead className="text-brand-blue font-bold">FILE ATTACHED</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPayments ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.title}</TableCell>
                      <TableCell>${Number(payment.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                      <TableCell>{format(parseISO(payment.payment_date), 'MMMM d, yyyy')}</TableCell>
                      <TableCell>{payment.comments || '-'}</TableCell>
                      <TableCell>{payment.file_attached ? 'Yes' : ''}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
      )}

      <Card className={`bg-gray-50 border border-gray-200 rounded-none w-max min-w-[400px] ${filteredPayments.length === 0 ? 'mt-0' : 'mt-8'}`}>
        <CardContent className="p-4 space-y-1 text-sm font-medium">
          <div className="flex justify-between">
            <span className="text-right flex-1 pr-6">Total from Salaries:</span>
            <span className="w-24 text-right">${totalSalaries.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-right flex-1 pr-6">Less: Total from Staff Payments:</span>
            <span className="w-24 text-right">${totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex justify-between font-bold pt-2">
            <span className="text-right flex-1 pr-6">Balance:</span>
            <span className="w-24 text-right">${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </CardContent>
      </Card>
      
      {/* Hide elements when actually printing natively via window.print() */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
           body * { visibility: hidden; }
           .p-6 { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }
           .p-6 * { visibility: visible; }
           button, input { display: none !important; }
        }
      `}} />
    </div>
  )
}
