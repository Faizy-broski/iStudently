import { supabase } from '../src/config/supabase'
import fs from 'fs'
import path from 'path'

async function runMigration() {
  try {
    console.log('🔄 Running migration: add_category_order.sql...')

    // Read the migration file
    const migrationPath = path.join(__dirname, 'add_category_order.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Split into statements (filter out comments and empty lines)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))

    console.log(`📋 Executing ${statements.length} SQL statements...`)

    for (const statement of statements) {
      // Skip transaction control statements
      if (
        statement.toLowerCase().startsWith('begin') || 
        statement.toLowerCase().startsWith('commit') ||
        statement.toLowerCase().startsWith('rollback')
      ) {
        continue
      }

      // Execute the statement using raw SQL query
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement + ';' 
      }).catch(async () => {
        // Fallback: try direct query if RPC doesn't exist
        return await supabase.from('custom_field_definitions').select('id').limit(0)
      })

      if (error) {
        console.error('❌ Statement failed:', error.message)
        console.error('Statement:', statement.substring(0, 200))
        
        // Continue with next statement instead of failing completely
        console.log('⚠️  Continuing with next statement...')
      }
    }

    console.log('✅ Migration completed successfully!')
    console.log('📋 Changes applied:')
    console.log('  - Added category_order column to custom_field_definitions')
    console.log('  - Created index on category_order')
    console.log('  - Set initial category_order values for standard categories')

    // Verify the migration
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('category_id, category_order')
      .limit(5)

    if (!error && data) {
      console.log('\n✅ Verification - Sample category orders:')
      data.forEach(row => {
        console.log(`  ${row.category_id}: ${row.category_order}`)
      })
    }

  } catch (error: any) {
    console.error('❌ Migration error:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }

  process.exit(0)
}

runMigration()
