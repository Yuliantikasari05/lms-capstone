import type { Paginated } from '../../../types'

export type CouponStatus = 'active' | 'inactive' | 'expired' | 'exhausted'
export type CouponDiscountType = 'percentage' | 'fixed'

export interface Coupon {
  id: number
  owner_type: 'admin' | 'institution'
  name: string | null
  code: string
  discount_type: CouponDiscountType
  discount_type_label: string
  discount_value: number
  discount_label: string
  usage_limit: number | null
  used_count: number
  usage_label: string
  course: { id: number; title: string } | null
  expires_at: string | null
  is_active: boolean
  status: CouponStatus
  status_label: string
  abilities: { update: boolean; delete: boolean } | null
}

export interface CouponSummary {
  total: number
  active: number
  total_redemptions: number
}

export interface CouponListResponse extends Paginated<Coupon> {
  summary: CouponSummary
}
