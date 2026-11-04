import { api } from '../../../lib/api'
import { useApiData } from '../../../lib/useApiData'
import type { MentorOption } from '../types'

/** Memuat daftar Mentor aktif (GET /users?role=mentor&status=active). Dipakai form tambah kursus dan ganti Mentor. */
export function useMentors(enabled = true) {
  return useApiData<MentorOption[]>(async () => {
    if (!enabled) return []
    const res = await api.get<{ data: MentorOption[] }>('/users', { params: { role: 'mentor', status: 'active', per_page: 100 } })
    return res.data.data
  }, [enabled])
}
