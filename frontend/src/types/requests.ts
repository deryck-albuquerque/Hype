export interface RequestItem {
  id: number
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'done' | 'in_test' | 'completed' | 'rejected'
  created_by_id: number
  developer_id: number
  qa_id: number
  developer_name: string
  qa_name: string
  created_at: string
  updated_at: string
}