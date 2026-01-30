# How to Add New Parent Fields

This guide shows you how to easily add new fields to the parent form without database migrations.

## Quick Method (Using Metadata - No Migration Needed)

Use this for custom or rarely-used fields:

### 1. Update the Form (AddParentForm.tsx)

Add the field to `formData` state:
```typescript
const [formData, setFormData] = useState(() => ({
  // ... existing fields
  newCustomField: "",  // Add your new field here
}));
```

Add the input in the form:
```typescript
<div>
  <Label htmlFor="newCustomField">New Custom Field</Label>
  <Input
    id="newCustomField"
    value={formData.newCustomField}
    onChange={(e) => setFormData({ ...formData, newCustomField: e.target.value })}
  />
</div>
```

Add it to metadata when submitting:
```typescript
metadata: {
  // ... existing metadata
  new_custom_field: formData.newCustomField,  // Add here
}
```

### 2. Display in View Details Dialog

Add to the view details section:
```typescript
<div>
  <p className="text-sm text-muted-foreground">New Custom Field</p>
  <p className="font-medium">{selectedParent.metadata?.new_custom_field || 'N/A'}</p>
</div>
```

### 3. Add to Edit Dialog

Add the editable field:
```typescript
<div>
  <Label htmlFor="edit-newCustomField">New Custom Field</Label>
  <Input
    id="edit-newCustomField"
    name="newCustomField"
    defaultValue={selectedParent.metadata?.new_custom_field || ''}
  />
</div>
```

Update the form submission:
```typescript
metadata: {
  ...selectedParent.metadata,
  new_custom_field: formData.get('newCustomField'),
}
```

**That's it!** No database migration needed. The field is stored in the `metadata` JSON column.

---

## Full Method (Database Column - For Commonly Used Fields)

Use this when a field becomes important enough to query/index:

### 1. Create Migration

Add to `backend/migrations/add_parent_fields.sql`:
```sql
ALTER TABLE parents ADD COLUMN IF NOT EXISTS new_field_name TEXT;
COMMENT ON COLUMN parents.new_field_name IS 'Description of the field';
```

### 2. Update Backend Types

In `backend/src/types/index.ts`:
```typescript
export interface Parent {
  // ... existing fields
  new_field_name: string | null  // Add here
}

export interface CreateParentDTO {
  // ... existing fields
  new_field_name?: string  // Add here
}

export interface UpdateParentDTO {
  // ... existing fields
  new_field_name?: string  // Add here
}
```

### 3. Update Backend Service

In `backend/src/services/parent.service.ts`:

For `createParent()`:
```typescript
.insert({
  // ... existing fields
  new_field_name: parentData.new_field_name,  // Add here
})
```

For `updateParent()`:
```typescript
if (updateData.new_field_name !== undefined) parentUpdates.new_field_name = updateData.new_field_name
```

### 4. Update Frontend Types

In `frontend/src/lib/api/parents.ts`:
```typescript
export interface Parent {
  // ... existing fields
  new_field_name: string | null  // Add here
}

export interface CreateParentDTO {
  // ... existing fields
  new_field_name?: string  // Add here
}

export interface UpdateParentDTO {
  // ... existing fields
  new_field_name?: string  // Add here
}
```

### 5. Update Form, View, and Edit

Same as steps 1-3 in Quick Method, but access directly:
```typescript
// Instead of: selectedParent.metadata?.new_field
// Use: selectedParent.new_field_name
```

---

## When to Use Each Method

**Use Metadata (Quick Method) when:**
- Testing a new feature
- Field is rarely used
- Field is user-specific/custom
- You want to iterate quickly

**Use Database Column (Full Method) when:**
- Field will be used by most/all parents
- Need to query or filter by this field
- Need to create indexes for performance
- Field is core to the application

---

## Example: Adding a "Blood Group" Field

### Using Metadata (Quick):

1. Add to form state: `bloodGroup: ""`
2. Add input: `<Input value={formData.bloodGroup} onChange={...} />`
3. Submit: `metadata: { blood_group: formData.bloodGroup }`
4. View: `{selectedParent.metadata?.blood_group}`
5. Edit: `defaultValue={selectedParent.metadata?.blood_group}`

### Using Database Column:

1. Run migration: `ALTER TABLE parents ADD COLUMN blood_group TEXT`
2. Add to all type interfaces: `blood_group: string | null`
3. Add to service insert/update
4. Add to form/view/edit with direct access

---

## Best Practice

1. **Start with metadata** - Add new fields quickly
2. **Gather usage data** - See if it's widely used
3. **Promote to column** - If heavily used, migrate to dedicated column
4. **Keep metadata** - Don't delete old metadata, just add the new column

This gives you flexibility and performance when you need it!
