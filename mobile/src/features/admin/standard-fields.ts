// Built-in form fields per person type and tab, with their default order and required flag
// (web: DEFAULT_FIELDS_BY_CATEGORY on /admin/<people>/custom-fields). `id` is what the server
// stores as field_label; `key` is the app label key (app.<key>).
export interface StandardField {
  id: string;
  key: string;
  sort: number;
  required: boolean;
}

export const STANDARD_FIELDS: Record<
  'student' | 'teacher' | 'staff' | 'parent',
  Record<string, StandardField[]>
> = {
  student: {
    personal: [
      {
        id: 'firstName',
        key: 'sf_first_name',
        sort: 1,
        required: true,
      },
      {
        id: 'fatherName',
        key: 'sf_father_s_name',
        sort: 2,
        required: true,
      },
      {
        id: 'grandfatherName',
        key: 'sf_grandfather_s_name',
        sort: 3,
        required: false,
      },
      {
        id: 'lastName',
        key: 'sf_surname',
        sort: 4,
        required: true,
      },
      {
        id: 'dateOfBirth',
        key: 'sf_date_of_birth',
        sort: 5,
        required: true,
      },
      {
        id: 'gender',
        key: 'sf_gender',
        sort: 6,
        required: true,
      },
      {
        id: 'studentPhoto',
        key: 'sf_student_photo',
        sort: 7,
        required: false,
      },
      {
        id: 'address',
        key: 'sf_address',
        sort: 8,
        required: false,
      },
      {
        id: 'email',
        key: 'sf_email',
        sort: 9,
        required: false,
      },
      {
        id: 'phoneNumber',
        key: 'sf_phone_number',
        sort: 10,
        required: false,
      },
    ],
    academic: [
      {
        id: 'grade_level_id',
        key: 'sf_grade_level',
        sort: 1,
        required: true,
      },
      {
        id: 'section_id',
        key: 'sf_section',
        sort: 2,
        required: true,
      },
      {
        id: 'admissionDate',
        key: 'sf_admission_date',
        sort: 3,
        required: true,
      },
      {
        id: 'previousSchoolHistory',
        key: 'sf_previous_school_history',
        sort: 4,
        required: false,
      },
    ],
    medical: [
      {
        id: 'bloodGroup',
        key: 'sf_blood_group',
        sort: 1,
        required: true,
      },
      {
        id: 'hasAllergies',
        key: 'sf_has_allergies',
        sort: 2,
        required: false,
      },
      {
        id: 'allergiesList',
        key: 'sf_allergies_list',
        sort: 3,
        required: false,
      },
      {
        id: 'medicalNotes',
        key: 'sf_medical_notes',
        sort: 4,
        required: false,
      },
    ],
    family: [
      {
        id: 'linkedParentId',
        key: 'sf_link_to_parent',
        sort: 1,
        required: false,
      },
      {
        id: 'parentRelationType',
        key: 'sf_relationship_type',
        sort: 2,
        required: false,
      },
      {
        id: 'emergencyContacts',
        key: 'sf_emergency_contacts',
        sort: 3,
        required: false,
      },
    ],
    system: [
      {
        id: 'username',
        key: 'sf_username',
        sort: 1,
        required: false,
      },
      {
        id: 'password',
        key: 'sf_password',
        sort: 2,
        required: false,
      },
    ],
  },
  teacher: {
    personal: [
      {
        id: 'first_name',
        key: 'sf_first_name',
        sort: 1,
        required: true,
      },
      {
        id: 'last_name',
        key: 'sf_last_name',
        sort: 2,
        required: true,
      },
      {
        id: 'cnic',
        key: 'sf_cnic',
        sort: 3,
        required: true,
      },
      {
        id: 'date_of_birth',
        key: 'sf_date_of_birth',
        sort: 4,
        required: false,
      },
      {
        id: 'gender',
        key: 'sf_gender',
        sort: 5,
        required: false,
      },
      {
        id: 'phone',
        key: 'sf_phone',
        sort: 6,
        required: false,
      },
      {
        id: 'email',
        key: 'sf_email',
        sort: 7,
        required: true,
      },
      {
        id: 'address',
        key: 'sf_address',
        sort: 8,
        required: false,
      },
    ],
    professional: [
      {
        id: 'employee_number',
        key: 'sf_employee_id',
        sort: 1,
        required: true,
      },
      {
        id: 'designation',
        key: 'sf_designation',
        sort: 2,
        required: true,
      },
      {
        id: 'department',
        key: 'sf_department',
        sort: 3,
        required: false,
      },
      {
        id: 'date_of_joining',
        key: 'sf_joining_date',
        sort: 4,
        required: false,
      },
      {
        id: 'employment_type',
        key: 'sf_employment_type',
        sort: 5,
        required: false,
      },
    ],
    qualifications: [
      {
        id: 'highestDegree',
        key: 'sf_highest_degree',
        sort: 1,
        required: false,
      },
      {
        id: 'majorField',
        key: 'sf_major_field',
        sort: 2,
        required: false,
      },
      {
        id: 'university',
        key: 'sf_university',
        sort: 3,
        required: false,
      },
      {
        id: 'yearOfGraduation',
        key: 'sf_year_of_graduation',
        sort: 4,
        required: false,
      },
      {
        id: 'certifications',
        key: 'sf_certifications',
        sort: 5,
        required: false,
      },
    ],
    employment: [
      {
        id: 'base_salary',
        key: 'sf_base_salary',
        sort: 1,
        required: false,
      },
      {
        id: 'bankAccount',
        key: 'sf_bank_account',
        sort: 2,
        required: false,
      },
      {
        id: 'workingHours',
        key: 'sf_working_hours',
        sort: 3,
        required: false,
      },
      {
        id: 'contractType',
        key: 'sf_contract_type',
        sort: 4,
        required: false,
      },
    ],
    system: [
      {
        id: 'username',
        key: 'sf_username',
        sort: 1,
        required: true,
      },
      {
        id: 'password',
        key: 'sf_password',
        sort: 2,
        required: true,
      },
      {
        id: 'userRole',
        key: 'sf_user_role',
        sort: 3,
        required: false,
      },
    ],
  },
  staff: {
    personal: [
      {
        id: 'first_name',
        key: 'sf_first_name',
        sort: 1,
        required: true,
      },
      {
        id: 'last_name',
        key: 'sf_last_name',
        sort: 2,
        required: true,
      },
      {
        id: 'email',
        key: 'sf_email',
        sort: 3,
        required: true,
      },
      {
        id: 'phone',
        key: 'sf_phone',
        sort: 4,
        required: false,
      },
      {
        id: 'date_of_birth',
        key: 'sf_date_of_birth',
        sort: 5,
        required: false,
      },
      {
        id: 'gender',
        key: 'sf_gender',
        sort: 6,
        required: false,
      },
      {
        id: 'cnic',
        key: 'sf_cnic',
        sort: 7,
        required: true,
      },
      {
        id: 'address',
        key: 'sf_address',
        sort: 8,
        required: false,
      },
    ],
    employment: [
      {
        id: 'title',
        key: 'sf_designation',
        sort: 1,
        required: true,
      },
      {
        id: 'department',
        key: 'sf_department',
        sort: 2,
        required: false,
      },
      {
        id: 'employment_type',
        key: 'sf_employment_type',
        sort: 3,
        required: false,
      },
      {
        id: 'date_of_joining',
        key: 'sf_date_of_joining',
        sort: 4,
        required: false,
      },
      {
        id: 'base_salary',
        key: 'sf_base_salary',
        sort: 5,
        required: false,
      },
    ],
    system: [
      {
        id: 'username',
        key: 'sf_username',
        sort: 1,
        required: true,
      },
      {
        id: 'password',
        key: 'sf_password',
        sort: 2,
        required: true,
      },
      {
        id: 'userRole',
        key: 'sf_user_role',
        sort: 3,
        required: false,
      },
    ],
  },
  parent: {
    personal: [
      {
        id: 'primaryFirstName',
        key: 'sf_first_name',
        sort: 1,
        required: true,
      },
      {
        id: 'primaryLastName',
        key: 'sf_last_name',
        sort: 2,
        required: true,
      },
      {
        id: 'primaryCNIC',
        key: 'sf_cnic',
        sort: 3,
        required: true,
      },
      {
        id: 'primaryPhone',
        key: 'sf_phone_number',
        sort: 4,
        required: true,
      },
      {
        id: 'primaryEmail',
        key: 'sf_email_address',
        sort: 5,
        required: true,
      },
    ],
    professional: [
      {
        id: 'primaryOccupation',
        key: 'sf_occupation',
        sort: 1,
        required: false,
      },
      {
        id: 'primaryWorkplace',
        key: 'sf_workplace',
        sort: 2,
        required: false,
      },
      {
        id: 'primaryIncome',
        key: 'sf_monthly_income',
        sort: 3,
        required: false,
      },
    ],
    contact: [
      {
        id: 'address',
        key: 'sf_home_address',
        sort: 1,
        required: false,
      },
      {
        id: 'city',
        key: 'sf_city',
        sort: 2,
        required: false,
      },
      {
        id: 'state',
        key: 'sf_state_province',
        sort: 3,
        required: false,
      },
      {
        id: 'zipCode',
        key: 'sf_zip_postal_code',
        sort: 4,
        required: false,
      },
      {
        id: 'country',
        key: 'sf_country',
        sort: 5,
        required: false,
      },
    ],
    emergency: [
      {
        id: 'emergencyContactName',
        key: 'sf_emergency_contact_name',
        sort: 1,
        required: false,
      },
      {
        id: 'emergencyContactRelation',
        key: 'sf_relationship',
        sort: 2,
        required: false,
      },
      {
        id: 'emergencyContactPhone',
        key: 'sf_phone',
        sort: 3,
        required: false,
      },
    ],
    system: [
      {
        id: 'username',
        key: 'sf_username',
        sort: 1,
        required: true,
      },
      {
        id: 'password',
        key: 'sf_password',
        sort: 2,
        required: true,
      },
    ],
  },
};
