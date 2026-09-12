/* ==========================================================================
   جسر الصلاحيات مع منصّة جهبذ
   استبدل getSession باستدعاء طبقة المصادقة لديكم (AuthProvider نفسها).
   ========================================================================== */

import type { QaidaContext } from './data';

// import { auth } from '@/lib/auth';   ← طبقة المصادقة لديكم

export async function requireQaidaContext(): Promise<QaidaContext | null> {
  // const session = await auth();
  // if (!session?.user) return null;
  // return {
  //   schoolId: session.user.schoolId,
  //   campusId: session.user.campusId,
  //   academicYearId: session.academicYearId,
  //   profileId: session.user.profileId,
  //   role: session.user.role,
  // };
  return null;
}

/** الأدوار التي ترى تقارير الصف — تُقيَّد أيضاً بنظام user_profiles لديكم */
const REPORT_ROLES = new Set(['admin', 'superadmin', 'teacher', 'counselor']);

export function canViewClassReports(role: string): boolean {
  return REPORT_ROLES.has(role);
}

/** وضع السبورة متاح للمعلّم والإدارة فقط */
export function canUseBoardMode(role: string): boolean {
  return REPORT_ROLES.has(role);
}
