import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
  const { data, error } = await supabase.from('profiles')
    .select('first_name, father_name, grandfather_name, last_name, email, phone, date_of_birth, gender, address, profile_photo_url')
    .limit(1);
    
  console.log('Error:', error);
}

check();
