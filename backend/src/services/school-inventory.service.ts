import { supabase } from '../config/supabase'

// ---- Types ----

export type CategoryType = 'CATEGORY' | 'STATUS' | 'LOCATION' | 'PERSON'

export interface InventoryCategory {
  id: string
  school_id: string
  campus_id?: string
  category_type: CategoryType
  title: string
  sort_order?: number
  color?: string
  created_at: string
  updated_at: string
  item_count?: number
}

export interface InventoryItem {
  id: string
  school_id: string
  campus_id?: string
  title: string
  quantity: number
  comments?: string
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
  categories?: InventoryCategory[]
}

export interface InventorySnapshot {
  id: string
  school_id: string
  campus_id?: string
  title: string
  created_by?: string
  created_at: string
}

export interface SnapshotDetail extends InventorySnapshot {
  items: Array<{
    id: string
    original_item_id?: string
    title: string
    quantity: number
    comments?: string
    sort_order?: number
    categories: Array<{
      id: string
      original_category_id?: string
      category_type: CategoryType
      title: string
    }>
  }>
}

// ---- Service ----

export class SchoolInventoryService {
  // ---- Categories ----

  async getCategories(
    schoolId: string,
    campusId?: string,
    type?: CategoryType
  ): Promise<InventoryCategory[]> {
    let query = supabase
      .from('school_inventory_categories')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    if (type) {
      query = query.eq('category_type', type)
    }

    const { data: categories, error } = await query
    if (error) throw error
    if (!categories || categories.length === 0) return []

    // Get item counts per category (scoped to same campus)
    const categoryIds = categories.map((c) => c.id)
    let cxiQuery = supabase
      .from('school_inventory_categoryxitem')
      .select('category_id, item_id')
      .in('category_id', categoryIds)

    const { data: cxiRows } = await cxiQuery

    // If campus-filtered, only count items that belong to this campus
    let validItemIds: Set<string> | null = null
    if (campusId && cxiRows && cxiRows.length > 0) {
      const allItemIds = [...new Set(cxiRows.map((r) => r.item_id))]
      const { data: campusItems } = await supabase
        .from('school_inventory_items')
        .select('id')
        .eq('school_id', schoolId)
        .or(`campus_id.eq.${campusId},campus_id.is.null`)
        .in('id', allItemIds)
      validItemIds = new Set((campusItems || []).map((i) => i.id))
    }

    const countMap: Record<string, number> = {}
    if (cxiRows) {
      for (const row of cxiRows) {
        if (validItemIds && !validItemIds.has(row.item_id)) continue
        countMap[row.category_id] = (countMap[row.category_id] || 0) + 1
      }
    }

    return categories.map((c) => ({ ...c, item_count: countMap[c.id] || 0 }))
  }

  async createCategory(
    schoolId: string,
    campusId: string | undefined,
    dto: { category_type: CategoryType; title: string; sort_order?: number; color?: string }
  ): Promise<InventoryCategory> {
    const { data, error } = await supabase
      .from('school_inventory_categories')
      .insert({ school_id: schoolId, campus_id: campusId || null, ...dto })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateCategory(
    id: string,
    schoolId: string,
    dto: { title?: string; sort_order?: number; color?: string }
  ): Promise<InventoryCategory> {
    const updateData: Record<string, unknown> = {}
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.sort_order !== undefined) updateData.sort_order = dto.sort_order
    if (dto.color !== undefined) updateData.color = dto.color

    const { data, error } = await supabase
      .from('school_inventory_categories')
      .update(updateData)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteCategory(id: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('school_inventory_categories')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw error
  }

  async bulkSaveCategories(
    schoolId: string,
    campusId: string | undefined,
    categories: Array<{
      id?: string
      category_type: CategoryType
      title: string
      sort_order?: number
      color?: string
    }>,
    existingIds: string[]
  ): Promise<InventoryCategory[]> {
    const newIds = categories.filter((c) => c.id).map((c) => c.id!)
    const toDelete = existingIds.filter((id) => !newIds.includes(id))

    for (const id of toDelete) {
      await this.deleteCategory(id, schoolId)
    }

    const results: InventoryCategory[] = []
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i]
      if (cat.id) {
        const updated = await this.updateCategory(cat.id, schoolId, {
          title: cat.title,
          sort_order: i + 1,
          color: cat.color,
        })
        results.push(updated)
      } else {
        const created = await this.createCategory(schoolId, campusId, {
          category_type: cat.category_type,
          title: cat.title,
          sort_order: i + 1,
          color: cat.color,
        })
        results.push(created)
      }
    }

    return results
  }

  // ---- Items ----

  async getItems(
    schoolId: string,
    campusId?: string,
    filters?: { category_id?: string }
  ): Promise<InventoryItem[]> {
    let itemIds: string[] | undefined

    if (filters?.category_id) {
      const { data: cxi } = await supabase
        .from('school_inventory_categoryxitem')
        .select('item_id')
        .eq('category_id', filters.category_id)

      itemIds = (cxi || []).map((r) => r.item_id)
      if (itemIds.length === 0) return []
    }

    let query = supabase
      .from('school_inventory_items')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    if (itemIds) {
      query = query.in('id', itemIds)
    }

    const { data: items, error } = await query
    if (error) throw error
    if (!items || items.length === 0) return []

    // Fetch category assignments
    const allItemIds = items.map((i) => i.id)
    const { data: cxi } = await supabase
      .from('school_inventory_categoryxitem')
      .select('item_id, category_id')
      .in('item_id', allItemIds)

    const { data: allCategories } = await supabase
      .from('school_inventory_categories')
      .select('*')
      .eq('school_id', schoolId)

    const catMap: Record<string, InventoryCategory> = {}
    if (allCategories) {
      for (const cat of allCategories) catMap[cat.id] = cat
    }

    const itemCatMap: Record<string, InventoryCategory[]> = {}
    if (cxi) {
      for (const row of cxi) {
        if (!itemCatMap[row.item_id]) itemCatMap[row.item_id] = []
        if (catMap[row.category_id]) {
          itemCatMap[row.item_id].push(catMap[row.category_id])
        }
      }
    }

    return items.map((item) => ({ ...item, categories: itemCatMap[item.id] || [] }))
  }

  async getItemById(id: string, schoolId: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('school_inventory_items')
      .select('*')
      .eq('id', id)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    const { data: cxi } = await supabase
      .from('school_inventory_categoryxitem')
      .select('category_id')
      .eq('item_id', id)

    let categories: InventoryCategory[] = []
    if (cxi && cxi.length > 0) {
      const catIds = cxi.map((r) => r.category_id)
      const { data: cats } = await supabase
        .from('school_inventory_categories')
        .select('*')
        .in('id', catIds)
      categories = cats || []
    }

    return { ...data, categories }
  }

  async createItem(
    schoolId: string,
    campusId: string | undefined,
    createdBy: string,
    dto: {
      title: string
      quantity?: number
      comments?: string
      sort_order?: number
      category_ids?: string[]
    }
  ): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('school_inventory_items')
      .insert({
        school_id: schoolId,
        campus_id: campusId || null,
        created_by: createdBy,
        title: dto.title,
        quantity: dto.quantity ?? 0,
        comments: dto.comments || null,
        sort_order: dto.sort_order ?? null,
      })
      .select()
      .single()

    if (error) throw error

    if (dto.category_ids && dto.category_ids.length > 0) {
      await this.syncItemCategories(data.id, dto.category_ids)
    }

    return { ...data, categories: [] }
  }

  async updateItem(
    id: string,
    schoolId: string,
    dto: {
      title?: string
      quantity?: number
      comments?: string
      sort_order?: number
      category_ids?: string[]
    }
  ): Promise<InventoryItem> {
    const updateData: Record<string, unknown> = {}
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.quantity !== undefined) updateData.quantity = dto.quantity
    if (dto.comments !== undefined) updateData.comments = dto.comments
    if (dto.sort_order !== undefined) updateData.sort_order = dto.sort_order

    const { data, error } = await supabase
      .from('school_inventory_items')
      .update(updateData)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error

    if (dto.category_ids !== undefined) {
      await this.syncItemCategories(id, dto.category_ids)
    }

    return { ...data, categories: [] }
  }

  async deleteItem(id: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('school_inventory_items')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw error
  }

  private async syncItemCategories(itemId: string, categoryIds: string[]): Promise<void> {
    await supabase.from('school_inventory_categoryxitem').delete().eq('item_id', itemId)

    if (categoryIds.length > 0) {
      const rows = categoryIds.map((category_id) => ({ item_id: itemId, category_id }))
      const { error } = await supabase.from('school_inventory_categoryxitem').insert(rows)
      if (error) throw error
    }
  }

  async bulkSaveItems(
    schoolId: string,
    campusId: string | undefined,
    createdBy: string,
    items: Array<{
      id?: string
      title: string
      quantity?: number
      comments?: string
      sort_order?: number
      category_ids?: string[]
    }>,
    existingIds: string[]
  ): Promise<InventoryItem[]> {
    const newIds = items.filter((i) => i.id).map((i) => i.id!)
    const toDelete = existingIds.filter((id) => !newIds.includes(id))

    for (const id of toDelete) {
      await this.deleteItem(id, schoolId)
    }

    const results: InventoryItem[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.id) {
        const updated = await this.updateItem(item.id, schoolId, {
          title: item.title,
          quantity: item.quantity,
          comments: item.comments,
          sort_order: i + 1,
          category_ids: item.category_ids,
        })
        results.push(updated)
      } else {
        const created = await this.createItem(schoolId, campusId, createdBy, {
          title: item.title,
          quantity: item.quantity,
          comments: item.comments,
          sort_order: i + 1,
          category_ids: item.category_ids,
        })
        results.push(created)
      }
    }

    return results
  }

  // ---- Snapshots ----

  async getSnapshots(schoolId: string, campusId?: string): Promise<InventorySnapshot[]> {
    let query = supabase
      .from('school_inventory_snapshots')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async createSnapshot(
    schoolId: string,
    campusId: string | undefined,
    createdBy: string,
    title: string
  ): Promise<InventorySnapshot> {
    const { data: snapshot, error } = await supabase
      .from('school_inventory_snapshots')
      .insert({ school_id: schoolId, campus_id: campusId || null, created_by: createdBy, title })
      .select()
      .single()

    if (error) throw error

    // Copy categories scoped to campus
    let catQuery = supabase
      .from('school_inventory_categories')
      .select('*')
      .eq('school_id', schoolId)

    if (campusId) {
      catQuery = catQuery.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data: categories } = await catQuery

    const catIdMap: Record<string, string> = {}
    if (categories && categories.length > 0) {
      const { data: snapCats } = await supabase
        .from('school_inventory_snapshot_categories')
        .insert(
          categories.map((c) => ({
            snapshot_id: snapshot.id,
            original_category_id: c.id,
            category_type: c.category_type,
            title: c.title,
            sort_order: c.sort_order,
            color: c.color,
          }))
        )
        .select()

      if (snapCats) {
        for (const sc of snapCats) {
          catIdMap[sc.original_category_id] = sc.id
        }
      }
    }

    // Copy items scoped to campus
    let itemQuery = supabase
      .from('school_inventory_items')
      .select('*')
      .eq('school_id', schoolId)

    if (campusId) {
      itemQuery = itemQuery.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data: items } = await itemQuery

    const itemIdMap: Record<string, string> = {}
    if (items && items.length > 0) {
      const { data: snapItems } = await supabase
        .from('school_inventory_snapshot_items')
        .insert(
          items.map((i) => ({
            snapshot_id: snapshot.id,
            original_item_id: i.id,
            title: i.title,
            quantity: i.quantity,
            comments: i.comments,
            sort_order: i.sort_order,
          }))
        )
        .select()

      if (snapItems) {
        for (const si of snapItems) {
          itemIdMap[si.original_item_id] = si.id
        }
      }

      const allItemIds = items.map((i) => i.id)
      const { data: cxi } = await supabase
        .from('school_inventory_categoryxitem')
        .select('item_id, category_id')
        .in('item_id', allItemIds)

      if (cxi && cxi.length > 0) {
        const snapCxi = cxi
          .filter((r) => itemIdMap[r.item_id] && catIdMap[r.category_id])
          .map((r) => ({
            snapshot_item_id: itemIdMap[r.item_id],
            snapshot_category_id: catIdMap[r.category_id],
          }))

        if (snapCxi.length > 0) {
          await supabase.from('school_inventory_snapshot_categoryxitem').insert(snapCxi)
        }
      }
    }

    return snapshot
  }

  async getSnapshotDetail(snapshotId: string, schoolId: string): Promise<SnapshotDetail | null> {
    const { data: snapshot, error } = await supabase
      .from('school_inventory_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    const { data: snapItems } = await supabase
      .from('school_inventory_snapshot_items')
      .select('*')
      .eq('snapshot_id', snapshotId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true })

    const { data: snapCats } = await supabase
      .from('school_inventory_snapshot_categories')
      .select('*')
      .eq('snapshot_id', snapshotId)

    const { data: snapCxi } = await supabase
      .from('school_inventory_snapshot_categoryxitem')
      .select('snapshot_item_id, snapshot_category_id')

    const snapCatMap: Record<string, any> = {}
    if (snapCats) {
      for (const sc of snapCats) snapCatMap[sc.id] = sc
    }

    const itemCatMap: Record<string, any[]> = {}
    if (snapCxi && snapCats) {
      for (const row of snapCxi) {
        if (!itemCatMap[row.snapshot_item_id]) itemCatMap[row.snapshot_item_id] = []
        if (snapCatMap[row.snapshot_category_id]) {
          itemCatMap[row.snapshot_item_id].push(snapCatMap[row.snapshot_category_id])
        }
      }
    }

    return {
      ...snapshot,
      items: (snapItems || []).map((si) => ({
        ...si,
        categories: (itemCatMap[si.id] || []).map((sc: any) => ({
          id: sc.id,
          original_category_id: sc.original_category_id,
          category_type: sc.category_type,
          title: sc.title,
        })),
      })),
    }
  }

  async deleteSnapshot(id: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('school_inventory_snapshots')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw error
  }
}
