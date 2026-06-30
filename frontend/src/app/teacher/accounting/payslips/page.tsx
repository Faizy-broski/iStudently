'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getSalaryRecords, getPayslipByPeriod, type SalaryRecord, type PayslipByPeriod } from '@/lib/api/salary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Printer, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { PayslipPreviewDialog } from '@/components/admin/PayslipDocument'

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TeacherPayslipsPage() {
  const { profile } = useAuth()
  const campusCtx = useCampus()

  const staffId = (profile as any)?.staff_id || ''
  const schoolId = profile?.school_id || ''
  const campusId = campusCtx?.selectedCampus?.id

  const [records, setRecords] = useState<SalaryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogPayslip, setDialogPayslip] = useState<PayslipByPeriod | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!staffId || !schoolId) {
      setLoading(false)
      return
    }
    getSalaryRecords(schoolId, { staff_id: staffId, campus_id: campusId, limit: 50 })
      .then((res) => setRecords(res.data))
      .catch(() => toast.error('Failed to load your salary records'))
      .finally(() => setLoading(false))
  }, [staffId, schoolId, campusId])

  async function handlePrint(record: SalaryRecord) {
    if (!staffId) return
    setLoadingId(record.id)
    try {
      const payslip = await getPayslipByPeriod(staffId, record.month, record.year, schoolId, campusId)
      setDialogPayslip(payslip)
      setDialogOpen(true)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load pay stub')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4 text-brand-teal">
        <div className="h-8 w-8 rounded bg-teal-100 flex items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-teal-600" />
        </div>
        <h1 className="text-3xl font-light">My Pay Stubs</h1>
      </div>

      <p className="text-sm text-muted-foreground -mt-4">
        View and print your official monthly payslips. Each pay stub includes a full itemized breakdown of earnings and deductions.
      </p>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No salary records found yet. Contact your administrator for payroll enquiries.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Base Salary</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right font-bold">Net Payable</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {MONTH_NAMES[record.month]} {record.year}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[record.status] || ''}`}
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(record.base_salary)}</TableCell>
                    <TableCell className="text-right text-sm text-red-600">
                      {record.total_deductions > 0 ? `-${fmt(record.total_deductions)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-[#1e3a5f]">
                      {fmt(record.net_salary)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handlePrint(record)}
                        disabled={loadingId === record.id}
                      >
                        {loadingId === record.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Printer className="h-3 w-3 mr-1" />}
                        Print Pay Stub
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PayslipPreviewDialog
        payslip={dialogPayslip}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogPayslip(null) }}
      />
    </div>
  )
}
