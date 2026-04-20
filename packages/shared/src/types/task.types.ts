import { UserSummary } from './user.types'

export type TaskType = 'CALL' | 'MEETING' | 'REMINDER'
export type TaskStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export interface Task {
  id: number
  title: string
  type: TaskType
  dueDate: string
  status: TaskStatus
  notes?: string
  assignedToId?: number
  assignedTo?: UserSummary
  leadId?: number
  lead?: { id: number; schoolName: string }
  schoolId?: number
  school?: { id: number; name: string }
  createdAt: string
  updatedAt: string
}

export interface CreateTaskDto {
  title: string
  type: TaskType
  dueDate: string
  notes?: string
  assignedToId?: number
  leadId?: number
  schoolId?: number
}

export interface UpdateTaskDto {
  title?: string
  type?: TaskType
  dueDate?: string
  status?: TaskStatus
  notes?: string
  assignedToId?: number
}
