import type { RecipientType } from '@studently/api-client';

// Personalisation tokens per recipient tab, same as the web (frontend/src/lib/substitution-fields.ts).
// Labels come from app.msg_group_<key> and app.msg_tok_<token without underscores, lower case>.

type Group = { key: string; fields: string[] };

const STUDENT: Group[] = [
  { key: 'personal', fields: ['__FULL_NAME__', '__FIRST_NAME__', '__FATHER_NAME__', '__GRANDFATHER_NAME__', '__LAST_NAME__', '__DATE_OF_BIRTH__', '__GENDER__', '__EMAIL__', '__PHONE__'] },
  { key: 'academic', fields: ['__STUDENT_NUMBER__', '__ADMISSION_NUMBER__', '__GRADE_LEVEL__', '__SECTION__'] },
  { key: 'parent', fields: ['__PARENT_NAME__', '__PARENT_PHONE__'] },
  { key: 'system', fields: ['__DATE__'] },
];
const STAFF: Group[] = [
  { key: 'personal', fields: ['__FULL_NAME__', '__FIRST_NAME__', '__LAST_NAME__', '__EMAIL__', '__PHONE__'] },
  { key: 'employment', fields: ['__EMPLOYEE_NUMBER__', '__TITLE__', '__DEPARTMENT__', '__ROLE__', '__QUALIFICATIONS__', '__SPECIALIZATION__', '__DATE_OF_JOINING__'] },
  { key: 'system', fields: ['__DATE__'] },
];
const PARENT: Group[] = [
  { key: 'personal', fields: ['__FULL_NAME__', '__FIRST_NAME__', '__LAST_NAME__', '__EMAIL__', '__PHONE__', '__ADDRESS__'] },
  { key: 'work', fields: ['__OCCUPATION__', '__WORKPLACE__'] },
  { key: 'child', fields: ['__CHILD_NAME__', '__CHILD_GRADE__'] },
  { key: 'system', fields: ['__DATE__'] },
];

export const substitutionGroups = (tab: RecipientType): Group[] => (tab === 'students' ? STUDENT : tab === 'parents' ? PARENT : STAFF);
