import { ROLE_CONFIG, isRoleSlug } from '../../../config/navigation'
import { STATUS_LABEL } from '../../../lib/format'
import type { AuditLogEntry } from '../../../types'

export const STATUS_TONE = { active: 'success', inactive: 'neutral', suspended: 'danger' } as const

export const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))

/** Kata sandi sementara yang baru dibuat/direset, ditampilkan sekali kepada Admin. */
export interface TemporaryPasswordInfo {
  name: string
  email: string
  password: string
  reason: 'created' | 'reset'
}

export const ACTION_LABELS: Record<string, string> = {
  'user.created': 'Akun dibuat',
  'user.updated': 'Data akun diubah',
  'user.deleted': 'Akun dihapus',
  'user.restored': 'Akun dipulihkan',
  'user.password_reset': 'Kata sandi direset oleh Admin',
  'user.exported': 'Daftar pengguna diekspor',
  'auth.password_changed': 'Kata sandi diganti oleh pemilik akun',
}

const FIELD_LABELS: Record<string, string> = { name: 'Nama', email: 'Email', status: 'Status', role: 'Role' }

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const text = String(value)
  if (field === 'status') return STATUS_LABEL[text] ?? text
  if (field === 'role') return isRoleSlug(text) ? ROLE_CONFIG[text].label : text
  return text
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** Rincian perubahan dalam bahasa manusia, mis. "Email: a@x.com → b@x.com". */
export function describeChange(entry: AuditLogEntry): string[] {
  const changes = asRecord(entry.changes)

  if (entry.action === 'user.updated') {
    const before = asRecord(changes.before)
    const after = asRecord(changes.after)
    return Object.keys(after).map((key) => `${FIELD_LABELS[key] ?? key}: ${show(key, before[key])} → ${show(key, after[key])}`)
  }

  if (entry.action === 'user.created') {
    const after = asRecord(changes.after)
    return ['role', 'status'].filter((key) => key in after).map((key) => `${FIELD_LABELS[key]}: ${show(key, after[key])}`)
  }

  if (entry.action === 'user.exported') {
    const filters = Object.entries(asRecord(changes.filters)).map(([key, value]) => `${key}=${String(value)}`)
    return [`${String(changes.rows ?? 0)} baris`, ...(filters.length ? [`Filter: ${filters.join(', ')}`] : [])]
  }

  return []
}
