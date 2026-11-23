import type { Paginated } from '../../../types'

export interface Level {
  id: number
  name: string
  min_xp: number
}

export interface GamificationSummary {
  students_count: number
  total_xp: number
  average_xp: number
  highest_xp: number
  levels_count: number
}

export interface LeaderboardEntry {
  rank: number
  user: { id: number; name: string; email: string }
  xp: number
  level: { id: number; name: string } | null
}

export interface XpTransaction {
  id: number
  amount: number
  source_type: string
  source_label: string
  source_id: number | null
  reason: string | null
  created_by: { id: number; name: string } | null
  created_at: string | null
}

export interface XpHistory extends Paginated<XpTransaction> {
  xp: number
  level: { id: number; name: string } | null
}
