export interface School {
  id: number
  name: string
  contactPerson: string
  phone: string
  email?: string
  location?: string
  notes?: string
  totalStudents?: number
  assignedToId?: number
  assignedTo?: { id: number; name: string; email: string; role: string }
  referredBySchoolId?: number
  referredBySchool?: { id: number; name: string }
  createdFromLeadId?: number
  createdAt: string
  updatedAt: string
}

export interface SchoolSummary {
  id: number
  name: string
  contactPerson: string
  phone: string
  email?: string
  totalStudents?: number
}

export interface CreateSchoolDto {
  name: string
  contactPerson: string
  phone: string
  email?: string
  location?: string
  notes?: string
  totalStudents?: number
  assignedToId?: number
  referredBySchoolId?: number
}

export interface UpdateSchoolDto {
  name?: string
  contactPerson?: string
  phone?: string
  email?: string
  location?: string
  notes?: string
  totalStudents?: number
  assignedToId?: number
  referredBySchoolId?: number
}

export interface SchoolListParams {
  search?: string
  page?: number
  limit?: number
}
