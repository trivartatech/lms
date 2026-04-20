import { Role } from '../constants/roles'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  createdAt: string
  updatedAt: string
}

export interface UserSummary {
  id: number
  name: string
  email: string
  role: Role
}

export interface CreateUserDto {
  name: string
  email: string
  password: string
  role: Role
}

export interface UpdateUserDto {
  name?: string
  email?: string
  password?: string
  role?: Role
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  user: UserSummary
}
