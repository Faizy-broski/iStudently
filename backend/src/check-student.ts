import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStudent() {
  const { data: student, error } = await supabase
    .from('students')
    .select('id, student_number, profile_id, custom_fields')
    .eq('student_number', 'JEHZ-2026-006')
    .single();

  if (error || !student) {
    console.error('Student not found:', error);
    process.exit(1);
  }

  console.log('Student:', JSON.stringify(student, null, 2));

  if (student.profile_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', student.profile_id)
      .single();
    console.log('Profile:', JSON.stringify(profile, null, 2));
  } else {
    console.log('No profile_id on student.');
  }
}

checkStudent();
