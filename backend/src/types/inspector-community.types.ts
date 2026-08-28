export interface InspectorBroadcast {
  id: string
  inspector_profile_id: string
  subject_id: string | null
  title: string
  body: string
  target_school_ids: string[]
  created_at: string
  updated_at: string
}

export interface ForumThread {
  id: string
  subject_id: string | null
  title: string
  created_by: string
  target_school_ids: string[]
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface ForumPost {
  id: string
  thread_id: string
  author_profile_id: string
  body: string
  created_at: string
}
