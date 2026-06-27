import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { StudentDashboardService } from './services/student-dashboard.service';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

async function check() {
  const service = new StudentDashboardService();
  const studentId = '1bd5fb28-ca69-4170-b12c-57f4aadd45d2'; // JEHZ-2026-006

  try {
    const info = await service.getStudentInfo(studentId);
    console.log(JSON.stringify(info, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
