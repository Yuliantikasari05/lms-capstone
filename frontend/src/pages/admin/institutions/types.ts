import type { Paginated } from '../../../types'

export type InstitutionStatus = 'active' | 'inactive' | 'suspended'

export interface Institution {
  id: number
  name: string
  description: string | null
  phone: string | null
  address: string | null
  email: string | null
  status: InstitutionStatus | null
  status_label: string | null
  account: { id: number; last_login_at: string | null; deleted: boolean } | null
  revenue_share_percent: number | null
  needs_revenue_share: boolean
  bank: {
    configured: boolean
    name: string | null
    account_holder: string | null
    account_last4: string | null
    label: string | null
  }
  programs_count?: number
  balance?: { earned: number; held: number; available: number }
  joined_at: string | null
  deleted_at: string | null
  abilities: { update: boolean; delete: boolean; manage_payouts: boolean } | null
}

export interface InstitutionSummary {
  total: number
  active: number
  institution_revenue_total: number
  platform_revenue_total: number
  pending_payouts_total: number
}

export interface InstitutionListResponse extends Paginated<Institution> {
  summary: InstitutionSummary
}

export interface InstitutionDashboard {
  period: { key: string; label: string; from: string; to: string }
  cards: {
    total_revenue: { value: number; previous: number; change_percent: number | null }
    content_sold: { value: number }
    active_students: { value: number; new_in_period: number }
    active_programs: { value: number; released_in_period: number }
    available_balance: { value: number }
  }
  revenue_chart: { bucket: string; points: { key: string; label: string; institution_amount: number; platform_amount: number }[] }
  finance: {
    revenue_share_percent: number | null
    gross_total: number
    institution_total: number
    platform_total: number
    paid_out_total: number
    pending_payout_total: number
    available_balance: number
    can_request_payout: boolean
    bank_account: string | null
  }
  revenue_split: { institution_percent: number | null; platform_percent: number | null; institution_amount: number; platform_amount: number }
  top_programs: { rank: number; course: { id: number; title: string }; sold: number; revenue: number; status: string | null; status_label: string | null }[]
  student_progress: { user: { id: number; name: string | null }; program: { id: number; title: string | null }; enrolled_at: string | null; progress_percent: number | null }[]
  active_vouchers: { total: number; items: { id: number; code: string; name: string | null; discount_label: string; usage_label: string; expires_at: string | null }[] }
  recent_payouts: Payout[]
}

export interface InstitutionDashboardResponse {
  data: InstitutionDashboard
  institution: Institution
  periods: { key: string; label: string }[]
}

export interface Payout {
  id: number
  code: string
  amount: number
  status: 'pending' | 'completed' | 'cancelled'
  status_label: string
  destination: { label: string | null; bank_name: string | null; account_holder: string | null; account_last4: string | null }
  note: string | null
  requested_by: { id: number; name: string } | null
  processed_by: { id: number; name: string } | null
  requested_at: string | null
  processed_at: string | null
}

export interface PayoutListResponse extends Paginated<Payout> {
  summary: { available_balance: number; pending_total: number; completed_total: number }
}

export interface CreateInstitutionResponse {
  data: Institution
  message?: string
  temporary_password?: string
}
