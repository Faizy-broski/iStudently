/* ==========================================================================
   قاعدة الجهابذة — طبقة الوصول إلى البيانات
   --------------------------------------------------------------------------
   هذا هو الملف الوحيد المرتبط بقاعدة بياناتكم. كل ما عداه مستقل تماماً.
   استبدل الدوال الأربع أدناه بما يوافق طبقتكم (Prisma / Drizzle / Supabase)
   ولن تحتاج إلى تعديل أي ملف آخر في الوحدة.

   الجداول المطلوبة في sql/001_qaida.sql
   ========================================================================== */

import { emptyProgress, type QaidaProgress } from './progress';

export interface QaidaContext {
  schoolId: string;
  campusId: string | null;
  academicYearId: string | null;
  profileId: string;          // معرّف ملف المستخدم في منصّة جهبذ
  role: string;
}

export interface SessionRow {
  id: string;
  profileId: string;
  stationId: string | null;
  worldId: string | null;
  correct: number;
  total: number;
  seconds: number;
  isReview: boolean;
  createdAt: string;
}

export interface ClassRow {
  profileId: string;
  studentName: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  progress: QaidaProgress;
  lastActiveAt: string | null;
}

/* ==========================================================================
   ↓↓↓ استبدل هذه الدوال بتنفيذكم ↓↓↓
   ========================================================================== */

// import { db } from '@/lib/db';   ← استوردوا عميل قاعدة البيانات لديكم

export async function getProgress(ctx: QaidaContext): Promise<QaidaProgress> {
  // مثال (Drizzle):
  // const row = await db.query.qaidaProgress.findFirst({
  //   where: and(eq(qaidaProgress.profileId, ctx.profileId),
  //              eq(qaidaProgress.academicYearId, ctx.academicYearId)),
  // });
  // return (row?.data as QaidaProgress) ?? emptyProgress();
  void ctx;
  return emptyProgress();
}

export async function saveProgress(ctx: QaidaContext, progress: QaidaProgress): Promise<void> {
  // upsert على (profile_id, academic_year_id)
  void ctx; void progress;
}

export async function insertSession(ctx: QaidaContext, row: Omit<SessionRow, 'id' | 'profileId' | 'createdAt'>): Promise<void> {
  void ctx; void row;
}

export async function listSessions(ctx: QaidaContext, limit = 30): Promise<SessionRow[]> {
  void ctx; void limit;
  return [];
}

/** تقرير الصف: كل طلاب الفرع (أو الفصل) مع تقدّمهم */
export async function listClassProgress(
  ctx: QaidaContext,
  filter: { gradeLevelId?: string; sectionId?: string },
): Promise<ClassRow[]> {
  void ctx; void filter;
  return [];
}
