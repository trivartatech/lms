import { PipelineStage } from '../constants/pipeline'
import { UserSummary } from './user.types'

export type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'LOST'

export interface Lead {
  id: number
  schoolName: string
  contactPerson: string
  phone: string
  email?: string
  location?: string
  status: LeadStatus
  pipelineStage: PipelineStage
  notes?: string
  assignedToId?: number
  assignedTo?: UserSummary
  referredBySchoolId?: number
  referredBySchool?: { id: number; name: string }
  referredByLeadId?: number
  referredByLead?: { id: number; schoolName: string }
  referralNotes?: string
  totalStudents?: number
  createdAt: string
  updatedAt: string
}

export interface CreateLeadDto {
  schoolName: string
  contactPerson: string
  phone: string
  email?: string
  location?: string
  status?: LeadStatus
  pipelineStage?: PipelineStage
  notes?: string
  assignedToId?: number
  referredBySchoolId?: number
  referredByLeadId?: number
  referralNotes?: string
  totalStudents?: number
}

export interface UpdateLeadDto {
  schoolName?: string
  contactPerson?: string
  phone?: string
  email?: string
  location?: string
  status?: LeadStatus
  pipelineStage?: PipelineStage
  notes?: string
  assignedToId?: number
  referralNotes?: string
}

export interface LeadListParams {
  stage?: PipelineStage
  status?: LeadStatus
  assignedTo?: number
  search?: string
  page?: number
  limit?: number
}

export interface PaginatedLeads {
  data: Lead[]
  total: number
  page: number
  limit: number
}
