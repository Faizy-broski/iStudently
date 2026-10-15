import type { FieldOrderEntity } from '@studently/api-client';
import { useCallback } from 'react';

import { adminFieldOrders } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * Built-in form fields that are required unless the school changed it (Default field order
 * settings). Ids and defaults are the web forms' (AddStudentForm / AddTeacherForm STANDARD_FIELDS).
 */
const DEFAULT_REQUIRED: Partial<Record<FieldOrderEntity, Record<string, boolean>>> = {
  student: {
    firstName: true, fatherName: true, grandfatherName: false, lastName: true, dateOfBirth: true, gender: true,
    address: false, email: false, phoneNumber: false, nationalId: false,
    grade_level_id: true, section_id: true, admissionDate: true, bloodGroup: true, medicalNotes: false,
  },
  teacher: {
    first_name: true, last_name: true, email: false, phone: false, gender: false, date_of_birth: false,
    employment_type: true, payment_type: true, date_of_joining: false, title: false, department: false, base_salary: false,
    qualifications: false, specialization: false,
  },
  parent: {
    primaryFirstName: true, primaryLastName: true, primaryCNIC: true, primaryPhone: true, primaryEmail: false,
    primaryOccupation: true, primaryWorkplace: false, primaryIncome: false,
    address: false, city: false, state: false, zipCode: false, country: false,
    emergencyContactName: false, emergencyContactRelation: false, emergencyContactPhone: false, notes: false,
  },
};
DEFAULT_REQUIRED.staff = DEFAULT_REQUIRED.teacher;

/** isRequired(fieldId) for a form, with the school's overrides applied (same rule as the web). */
export function useRequiredFields(entity: FieldOrderEntity, campusId?: string) {
  const orders = useApi(['admin', 'field-orders', entity, campusId ?? 'school'], () => adminFieldOrders.list(entity, campusId));
  const isRequired = useCallback(
    (fieldId: string) => {
      const saved = orders.data?.find((o) => o.field_label === fieldId);
      if (saved && typeof saved.required === 'boolean') return saved.required;
      return DEFAULT_REQUIRED[entity]?.[fieldId] ?? false;
    },
    [orders.data, entity],
  );
  return { isRequired, isLoading: orders.isLoading };
}
