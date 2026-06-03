import { supabase } from '../src/config/supabase'
import fs from 'fs'
import path from 'path'

async function runMigration() {
  try {
    console.log('🔄 Running migration: multi_school_admin_support.sql...')

    // Read the migration file
    const migrationPath = path.join(__dirname, 'multi_school_admin_support.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // If RPC doesn't exist, try direct execution (split by statements)
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        // Skip transaction blocks if any (basic splitting might break complex PL/pgSQL)
        if (statement.toLowerCase().startsWith('begin') || statement.toLowerCase().startsWith('commit')) continue

        const { error: execError } = await supabase.rpc('query', {
          query_text: statement + ';'
        })

        if (execError) {
          console.error('❌ Migration failed:', execError.message)
          console.error('Statement:', statement)
          process.exit(1)
        }
      }
    }

    console.log('✅ Migration completed successfully!')
    console.log('📋 New tables/columns added:')
    console.log('  - admin_schools table created')
    console.log('  - RLS policies enabled')
    console.log('  - Existing profiles migrated to admin_schools')

  } catch (error: any) {
    console.error('❌ Migration error:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

runMigration()
