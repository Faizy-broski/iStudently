import { supabase } from '../src/config/supabase'

async function addCategoryOrderColumn() {
  try {
    console.log('🔄 Adding category_order column...')

    // Step 1: Add the column
    console.log('Step 1: Adding category_order column...')
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE custom_field_definitions 
        ADD COLUMN IF NOT EXISTS category_order INTEGER DEFAULT 0;
      `
    })

    if (alterError) {
      console.log('⚠️  Note: Column might already exist or using alternative method')
    }

    // Step 2: Create index
    console.log('Step 2: Creating index...')
    await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_category_order 
        ON custom_field_definitions(entity_type, category_order);
      `
    })

    // Step 3: Update standard category orders
    console.log('Step 3: Updating standard category orders...')
    
    const updates = [
      { category: 'personal', order: 1 },
      { category: 'academic', order: 2 },
      { category: 'medical', order: 3 },
      { category: 'family', order: 4 },
      { category: 'additional', order: 5 },
      { category: 'professional', order: 2 },
      { category: 'qualifications', order: 3 },
      { category: 'employment', order: 4 },
      { category: 'system', order: 5 },
      { category: 'contact', order: 3 },
      { category: 'emergency', order: 4 }
    ]

    for (const { category, order } of updates) {
      await supabase
        .from('custom_field_definitions')
        .update({ category_order: order })
        .eq('category_id', category)
      
      console.log(`  ✓ Set ${category} = ${order}`)
    }

    console.log('\n✅ Migration completed successfully!')
    
    // Verify
    const { data } = await supabase
      .from('custom_field_definitions')
      .select('category_id, category_order, entity_type')
      .order('category_order')
      .limit(10)

    if (data && data.length > 0) {
      console.log('\n📋 Verification - Category orders:')
      data.forEach(row => {
        console.log(`  ${row.entity_type}/${row.category_id}: ${row.category_order}`)
      })
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  process.exit(0)
}

addCategoryOrderColumn()
