'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { getStaffOwnSalaries, getStaffOwnPayments, type AccountingSalary } from '@/lib/api/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { DownloadCloud, Loader2, Search } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function TeacherSalariesPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data: salariesRes, isLoading: loadingSalaries } = useSWR(
    'teacher-own-salaries',
    () => getStaffOwnSalaries(),
    { revalidateOnFocus: false }
  )

  const { data: paymentsRes } = useSWR(
    'teacher-own-payments-totals',
    () => getStaffOwnPayments(),
    { revalidateOnFocus: false }
  )

  const salaries = salariesRes?.data || []
  const payments = paymentsRes?.data || []

  // Filter logic
  const filteredSalaries = salaries.filter(s => 
    s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.comments?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <span className="text-xl">💰</span>
        </div>
        <h1 className="text-3xl font-light">Salaries</h1>
      </div>

      <div className="flex justify-between items-center bg-gray-50 border-y py-2 px-1">
        <p className="text-sm font-semibold">{filteredSalaries.length} salary was found.</p>
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

      <Card className="rounded-none shadow-sm border-gray-200">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="text-brand-blue font-bold">SALARY</TableHead>
              <TableHead className="text-brand-blue font-bold">AMOUNT</TableHead>
              <TableHead className="text-brand-blue font-bold">ASSIGNED</TableHead>
              <TableHead className="text-brand-blue font-bold">DUE</TableHead>
              <TableHead className="text-brand-blue font-bold">COMMENT</TableHead>
              <TableHead className="text-brand-blue font-bold">FILE ATTACHED</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingSalaries ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredSalaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No salaries were found.
                </TableCell>
              </TableRow>
            ) : (
              filteredSalaries.map((salary) => (
                <TableRow key={salary.id}>
                  <TableCell>{salary.title}</TableCell>
                  <TableCell>${Number(salary.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell>{format(parseISO(salary.assigned_date), 'MMMM d, yyyy')}</TableCell>
                  <TableCell>{salary.due_date ? format(parseISO(salary.due_date), 'MMMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{salary.comments || '-'}</TableCell>
                  <TableCell>{salary.file_attached ? 'Yes' : ''}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="bg-gray-50 border border-gray-200 rounded-none mt-8 w-max min-w-[400px]">
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
