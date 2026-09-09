'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lock, Shield, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from 'next-intl';
import {
  ConfidentialFamilyStatus,
  CONFIDENTIAL_FAMILY_STATUS_OPTIONS,
} from '@/lib/constants/confidential-family-status';
import { updateStudentConfidentialStatus } from '@/lib/api/students';

interface ConfidentialFamilyStatusDialogProps {
  studentId: string;
  studentName?: string;
  studentNumber?: string;
  currentStatus?: ConfidentialFamilyStatus | string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newStatus: ConfidentialFamilyStatus) => void;
}

export function ConfidentialFamilyStatusDialog({
  studentId,
  studentName = '',
  studentNumber = '',
  currentStatus = 'NONE',
  isOpen,
  onClose,
  onSuccess,
}: ConfidentialFamilyStatusDialogProps) {
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [selectedStatus, setSelectedStatus] = useState<ConfidentialFamilyStatus>(
    (currentStatus as ConfidentialFamilyStatus) || 'NONE'
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedStatus((currentStatus as ConfidentialFamilyStatus) || 'NONE');
  }, [currentStatus, isOpen]);

  const handleSave = async () => {
    if (!studentId) return;

    setSaving(true);
    try {
      const res = await updateStudentConfidentialStatus(studentId, selectedStatus);
      if (res.success) {
        toast.success(
          isAr
            ? 'تم تحديث الحالة العائلية السرية بنجاح'
            : 'Confidential family status updated successfully'
        );
        onSuccess?.(selectedStatus);
        onClose();
      } else {
        toast.error(res.error || (isAr ? 'فشل التحديث' : 'Failed to update'));
      }
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'حدث خطأ أثناء التحديث' : 'An error occurred'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Shield className="h-5 w-5" />
            <DialogTitle>
              {isAr ? 'الحالة العائلية السرية' : 'Confidential Family Status'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {studentName && <span className="font-semibold text-foreground">{studentName} </span>}
            {studentNumber && <span>({studentNumber}) • </span>}
            {isAr
              ? 'حقل مقيد مرئي فقط للإدارة والمرشد والمعلم، ومحجوب تماماً عن الطلاب وأولياء الأمور.'
              : 'Restricted field visible only to administrators, counselors, and teachers. Completely stripped for students and parents.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <Label htmlFor="confidential-status-select" className="text-sm font-medium">
              {isAr ? 'اختر الحالة العائلية' : 'Select Family Status'}
            </Label>
            <Select
              value={selectedStatus}
              onValueChange={(val) => setSelectedStatus(val as ConfidentialFamilyStatus)}
            >
              <SelectTrigger id="confidential-status-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENTIAL_FAMILY_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {opt.value !== 'NONE' && (
                        <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      )}
                      <span>{isAr ? opt.label.ar : opt.label.en}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <p>
              {isAr
                ? 'يتم تشفير وتصفية هذه البيانات على مستوى الخادم لضمان أقصى درجات الخصوصية للطالب.'
                : 'This information is filtered server-side to guarantee strict privacy for the student.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-[#022172] hover:bg-[#022172]/90 text-white">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfidentialFamilyStatusDialog;
