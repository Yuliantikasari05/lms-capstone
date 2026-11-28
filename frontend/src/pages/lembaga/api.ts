import type { Course, CourseModule, ClassSession, Material, MaterialType } from '../../features/courses/types'
import { API_BASE_URL, api } from '../../lib/api'
import type { Paginated } from '../../types'

/** Program Lembaga (kursus jenis institution) seperti dikirim backend. */
export interface LembagaProgram {
  id: number
  title: string
  description: string | null
  category: string | null
  status: 'draft' | 'active' | 'inactive'
  status_label: string
  price: number
  discount_price: number | null
  price_label: string
  is_free: boolean
  modules_count: number
  sessions_count: number
  students_count: number
  sold_count: number
  revenue: number
  created_at: string | null
  updated_at: string | null
}

export interface LembagaCards {
  active_programs: number
  total_students: number
  total_enrollments: number
  total_revenue: number
  active_vouchers: number
  used_vouchers: number
}

export interface LembagaInstitution {
  id: number
  name: string
  description: string | null
  phone: string | null
  address: string | null
  revenue_share_percent: number | null
  bank: { configured: boolean; label: string | null }
}

export interface LembagaSummary {
  institution: LembagaInstitution
  cards: LembagaCards
  programs: LembagaProgram[]
}

export interface LembagaReport {
  summary: LembagaCards
  programs: LembagaProgram[]
}

export interface LembagaVoucher {
  id: number
  name: string | null
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  discount_label: string
  usage_limit: number | null
  used_count: number
  status: 'active' | 'inactive' | 'expired' | 'exhausted'
  status_label: string
  is_active: boolean
  expires_at: string | null
  course: { id: number; title: string } | null
  created_at: string | null
}

export interface LembagaVoucherSummary {
  active_total: number
  used_total: number
  expiring_soon: number
}

export interface LembagaStudent {
  id: number
  name: string
  email: string
  status: string
  status_label: string
  initials: string
  enrolled_at: string | null
  programs: { id: number; title: string }[]
}

export interface LembagaStudentDetail extends Omit<LembagaStudent, 'programs'> {
  programs: {
    enrollment_id: number
    course: { id: number | null; title: string | null }
    enrolled_at: string | null
    status: string
    progress_percent: number | null
  }[]
  metrics: {
    programs_count: number
    progress_percent: number | null
    average_score: number | null
    certificates: number
  }
}

export interface LembagaProfile {
  id: number
  name: string
  description: string | null
  phone: string | null
  address: string | null
  revenue_share_percent: number | null
  bank: { configured: boolean; name: string | null; account_holder: string | null; account_last4: string | null; label: string | null }
  account: { id: number; name: string; email: string; status: string; last_login_at: string | null }
  stats: { total_programs: number; total_students: number; total_enrollments: number; rating: number | null }
}

// ------------------------------------------------------------------ dashboard & laporan

export async function fetchSummary(): Promise<LembagaSummary> {
  return (await api.get<{ data: LembagaSummary }>('/lembaga/summary')).data.data
}

export async function fetchReport(): Promise<LembagaReport> {
  return (await api.get<{ data: LembagaReport }>('/lembaga/reports')).data.data
}

// ------------------------------------------------------------------ program & kurikulum

/** Program milik lembaga (GET /courses sudah dibatasi CoursePolicy untuk role Lembaga). */
export async function fetchPrograms(): Promise<Course[]> {
  const response = await api.get<Paginated<Course>>('/courses', {
    params: { type: 'institution', per_page: 100 },
  })

  return response.data.data
}

export interface ProgramInput {
  title: string
  description?: string | null
  category?: string | null
  status?: 'draft' | 'active'
}

export async function createProgram(input: ProgramInput): Promise<Course> {
  const response = await api.post<{ data: Course }>('/courses', { type: 'institution', ...input })

  return response.data.data
}

export async function updateProgram(id: number, input: Partial<ProgramInput>): Promise<Course> {
  const response = await api.patch<{ data: Course }>(`/courses/${id}`, input)

  return response.data.data
}

export async function fetchProgram(id: number): Promise<Course> {
  return (await api.get<{ data: Course }>(`/courses/${id}`)).data.data
}

export async function listModules(courseId: number): Promise<CourseModule[]> {
  return (await api.get<{ data: CourseModule[] }>(`/courses/${courseId}/modules`)).data.data
}

export async function createModule(courseId: number, title: string): Promise<CourseModule> {
  const response = await api.post<{ data: CourseModule }>(`/courses/${courseId}/modules`, { title })

  return response.data.data
}

export interface MaterialInput {
  title: string
  type: MaterialType
  description?: string | null
  file?: File | null
  externalUrl?: string | null
}

/** Format berkas dan tautan selalu multipart agar satu alur menangani keduanya. */
function materialForm(input: Omit<MaterialInput, 'type'> & { type?: MaterialType }): FormData {
  const body = new FormData()
  body.append('title', input.title)
  if (input.type) body.append('type', input.type)
  if (input.description !== undefined) body.append('description', input.description ?? '')
  body.append('external_url', input.externalUrl ?? '')
  if (input.file) body.append('file', input.file)

  return body
}

export async function createMaterial(moduleId: number, input: MaterialInput): Promise<Material> {
  return (await api.post<{ data: Material }>(`/modules/${moduleId}/materials`, materialForm(input))).data.data
}

export async function updateMaterial(
  id: number,
  input: { title: string; description?: string | null; file?: File | null; externalUrl?: string | null },
): Promise<Material> {
  const body = materialForm(input)
  // Tipe materi tidak dapat diubah; PHP tidak membaca multipart pada PATCH.
  body.append('_method', 'PATCH')

  return (await api.post<{ data: Material }>(`/materials/${id}`, body)).data.data
}

export async function deleteMaterial(id: number): Promise<void> {
  await api.delete(`/materials/${id}`)
}

/** Berkas materi hanya bisa diambil lewat endpoint berizin ini, bukan URL publik. */
export function materialFileUrl(id: number): string {
  return `${API_BASE_URL}/materials/${id}/file`
}

export interface SessionInput {
  title: string
  description?: string | null
  date: string
  startTime: string
  endTime: string
  meetingUrl?: string | null
  location?: string | null
}

export async function listSessions(courseId: number): Promise<ClassSession[]> {
  return (await api.get<{ data: ClassSession[] }>(`/courses/${courseId}/sessions`)).data.data
}

function sessionPayload(input: SessionInput): Record<string, unknown> {
  return {
    title: input.title,
    description: input.description || null,
    starts_at: `${input.date}T${input.startTime}:00`,
    ends_at: `${input.date}T${input.endTime}:00`,
    meeting_url: input.meetingUrl ?? null,
    location: input.location ?? null,
  }
}

export async function createSession(courseId: number, input: SessionInput): Promise<ClassSession> {
  return (await api.post<{ data: ClassSession }>(`/courses/${courseId}/sessions`, sessionPayload(input))).data.data
}

export async function updateSession(id: number, input: SessionInput): Promise<ClassSession> {
  return (await api.patch<{ data: ClassSession }>(`/sessions/${id}`, sessionPayload(input))).data.data
}

export async function deleteSession(id: number): Promise<void> {
  await api.delete(`/sessions/${id}`)
}

// ------------------------------------------------------------------ harga

export async function updatePricing(courseId: number, price: number, discountPrice: number | null): Promise<LembagaProgram> {
  return (await api.patch<{ data: LembagaProgram }>(`/lembaga/programs/${courseId}/pricing`, {
    price,
    discount_price: discountPrice,
  })).data.data
}

// ------------------------------------------------------------------ voucher

export async function fetchVouchers(): Promise<{ data: LembagaVoucher[]; summary: LembagaVoucherSummary }> {
  const response = await api.get<{ data: LembagaVoucher[]; summary: LembagaVoucherSummary }>('/lembaga/vouchers', {
    params: { per_page: 100 },
  })

  return response.data
}

export interface VoucherInput {
  name: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  usage_limit: number | null
  course_id: number | null
  expires_at: string
  is_active?: boolean
}

export async function createVoucher(input: VoucherInput): Promise<LembagaVoucher> {
  return (await api.post<{ data: LembagaVoucher }>('/lembaga/vouchers', input)).data.data
}

export async function updateVoucher(id: number, input: Partial<VoucherInput>): Promise<LembagaVoucher> {
  return (await api.patch<{ data: LembagaVoucher }>(`/lembaga/vouchers/${id}`, input)).data.data
}

export async function deleteVoucher(id: number): Promise<void> {
  await api.delete(`/lembaga/vouchers/${id}`)
}

// ------------------------------------------------------------------ siswa

export async function fetchStudents(params: { q?: string; page?: number; per_page?: number }): Promise<Paginated<LembagaStudent>> {
  const response = await api.get<Paginated<LembagaStudent>>('/lembaga/students', {
    params: { q: params.q || undefined, page: params.page ?? 1, per_page: params.per_page ?? 7 },
  })

  return response.data
}

export async function fetchStudent(id: number | string): Promise<LembagaStudentDetail> {
  return (await api.get<{ data: LembagaStudentDetail }>(`/lembaga/students/${id}`)).data.data
}

// ------------------------------------------------------------------ profil

export async function fetchProfile(): Promise<LembagaProfile> {
  return (await api.get<{ data: LembagaProfile }>('/lembaga/profile')).data.data
}

export async function updateProfile(input: { name?: string; description?: string | null; phone?: string | null; address?: string | null }): Promise<void> {
  await api.patch('/lembaga/profile', input)
}
