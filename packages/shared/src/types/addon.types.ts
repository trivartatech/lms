export type AddonCategory = 'ERP' | 'ADDON'

export interface PricingTier {
  label: string
  maxStudents: number
  price: number
}

export interface Addon {
  id: number
  name: string
  description?: string
  price: number
  category: AddonCategory
  tiers?: PricingTier[] | null
  createdAt: string
}

export interface SchoolAddon {
  id: number
  schoolId?: number | null
  leadId?: number | null
  addonId: number
  addon: Addon
  price: number
  startDate: string
}

export interface CreateAddonDto {
  name: string
  description?: string
  price: number
  category?: AddonCategory
}

export interface UpdateAddonDto {
  name?: string
  description?: string
  price?: number
  category?: AddonCategory
}
