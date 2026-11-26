import type {
  ClassSession,
  Course,
  CourseModule,
  Material,
  MaterialType,
} from '../../features/courses/types'
import { API_BASE_URL, api } from '../../lib/api'
import type { Paginated } from '../../types'
import { courseAudience } from './courseData'
import { sessionTypeForCourseType, type MentorSessionType } from './sessionData'

export type CurriculumItemType = 'materi' | 'tugas' | 'ujian' | 'sesi'
export type ItemPublicationStatus = 'draft' | 'published'
export type CurriculumSessionMode = 'Online' | 'Offline'

export interface CurriculumItem {
  id: string
  title: string
  description: string
  type: CurriculumItemType
  status: ItemPublicationStatus
  xpPoints: number
  detail: string
  /** id baris backend; dipakai untuk mengubah/menghapus item. */
  materialId?: number
  assignmentId?: number
  materialType?: MaterialType
  materialFormat?: string
  durationMinutes?: number
  resource?: string
  fileUrl?: string | null
  externalUrl?: string | null
  attachment?: File
  sessionId?: number
  meetingLink?: string
  date?: string
  startTime?: string
  endTime?: string
  sessionType?: MentorSessionType
  mode?: CurriculumSessionMode
  location?: string
}

export interface CurriculumModule {
  id: number
  courseId: number
  title: string
  description: string
  items: CurriculumItem[]
  expanded: boolean
}

export interface CurriculumDiscussion {
  id: string
  title: string
  author: string
  role: 'Mentor' | 'Siswa' | 'Karyawan'
  date: string
  message: string
  replyCount: number
  likes: number
}

export interface CurriculumClass {
  id: number
  title: string
  description: string
  audience: 'Siswa' | 'Karyawan'
  students: number
  allowsXp: boolean
  sessionType: MentorSessionType | null
  modules: CurriculumModule[]
  /** Sesi kursus, juga ditampilkan pada modul pertama agar susunan tampilan lama tetap sama. */
  sessions: CurriculumItem[]
  discussions: CurriculumDiscussion[]
}

const pad = (value: number) => String(value).padStart(2, '0')

function localDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localTime(iso: string): string {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function materialFormat(material: Material): string {
  switch (material.type) {
    case 'pdf':
      return 'PDF'
    case 'video':
      return 'Video'
    case 'link':
      return 'Tautan'
    default: {
      const name = (material.file?.name ?? '').toLowerCase()
      return name.endsWith('.ppt') || name.endsWith('.pptx') ? 'PPTX' : 'Dokumen'
    }
  }
}

function toMaterialItem(material: Material): CurriculumItem {
  const format = materialFormat(material)
  const duration = material.type === 'video' ? material.duration_minutes : null

  return {
    id: `material-${material.id}`,
    materialId: material.id,
    materialType: material.type,
    title: material.title,
    description: material.description ?? '',
    type: 'materi',
    status: 'published',
    xpPoints: material.xp_points,
    detail: duration ? `${format} · ${duration} menit` : format,
    materialFormat: format,
    durationMinutes: duration ?? undefined,
    resource: material.file?.name ?? material.external_url ?? '',
    // File materi privat: hanya bisa diambil lewat endpoint ber-otorisasi ini.
    fileUrl: material.has_file ? `${API_BASE_URL}/materials/${material.id}/file` : null,
    externalUrl: material.external_url,
  }
}

function toSessionItem(session: ClassSession): CurriculumItem {
  return {
    id: `session-${session.id}`,
    sessionId: session.id,
    title: session.title,
    description: session.description ?? '',
    type: 'sesi',
    status: 'published',
    xpPoints: 0,
    detail: `${localTime(session.starts_at)}–${localTime(session.ends_at)}${session.meeting_url ? ' · Online' : ''}`,
    date: localDate(session.starts_at),
    startTime: localTime(session.starts_at),
    endTime: localTime(session.ends_at),
    sessionType: sessionTypeForCourseType(session.type === 'training' ? 'training' : session.type === 'webinar' ? 'webinar' : 'academic') ?? undefined,
    mode: session.meeting_url ? 'Online' : 'Offline',
    meetingLink: session.meeting_url ?? '',
  }
}

function toCurriculumClass(course: Course, modules: CourseModule[], sessions: ClassSession[]): CurriculumClass {
  const sessionItems = sessions.map(toSessionItem)

  return {
    id: course.id,
    title: course.title,
    description: course.description ?? '',
    audience: courseAudience(course.type) === 'siswa' ? 'Siswa' : 'Karyawan',
    students: course.participants_count ?? 0,
    allowsXp: course.type === 'academic' || course.type === 'institution',
    sessionType: sessionTypeForCourseType(course.type),
    modules: modules.map((module, index) => ({
      id: module.id,
      courseId: course.id,
      title: module.title,
      description: module.description ?? '',
      expanded: index === 0,
      items: [
        ...(module.materials ?? []).map(toMaterialItem),
        ...(index === 0 ? sessionItems : []),
      ],
    })),
    sessions: sessionItems,
    // Belum ada model diskusi di backend; tab Diskusi menampilkan keadaan kosong.
    discussions: [],
  }
}

/** Kursus yang diampu Mentor beserta modul, materi, dan sesinya. */
export async function fetchCurriculum(): Promise<CurriculumClass[]> {
  const courses = (await api.get<Paginated<Course>>('/courses', { params: { per_page: 100 } })).data.data

  return Promise.all(courses.map(async (course) => {
    const [modules, sessions] = await Promise.all([
      api.get<{ data: CourseModule[] }>(`/courses/${course.id}/modules`),
      api.get<{ data: ClassSession[] }>(`/courses/${course.id}/sessions`),
    ])

    return toCurriculumClass(course, modules.data.data, sessions.data.data)
  }))
}

export interface ModuleInput {
  title: string
  description?: string
}

export async function createModule(courseId: number, input: ModuleInput): Promise<void> {
  await api.post(`/courses/${courseId}/modules`, input)
}

export async function updateModule(moduleId: number, input: ModuleInput): Promise<void> {
  await api.patch(`/modules/${moduleId}`, input)
}

export async function removeModule(moduleId: number): Promise<void> {
  await api.delete(`/modules/${moduleId}`)
}

/** Tipe materi yang dikirim ke backend. Tipe tidak dapat diubah lewat PATCH. */
export function materialTypeFor(item: CurriculumItem): MaterialType {
  if (item.attachment) {
    const name = item.attachment.name.toLowerCase()
    if (name.endsWith('.pdf')) return 'pdf'
    if (/\.(mp4|webm)$/.test(name)) return 'video'
    return 'document'
  }

  if (item.materialFormat === 'Video' && item.externalUrl) return 'video'

  return 'link'
}

function materialBody(item: CurriculumItem, type: MaterialType, withType: boolean): FormData {
  const body = new FormData()
  body.append('title', item.title)
  body.append('description', item.description)
  if (withType) body.append('type', type)
  if (item.xpPoints > 0) body.append('xp_points', String(item.xpPoints))

  if (type === 'video' && item.durationMinutes) {
    body.append('duration_minutes', String(item.durationMinutes))
  }

  if (item.attachment) {
    body.append('file', item.attachment)
  } else if (item.externalUrl && (type === 'link' || type === 'video')) {
    body.append('external_url', item.externalUrl)
  }

  return body
}

export async function createMaterial(moduleId: number, item: CurriculumItem): Promise<void> {
  const type = materialTypeFor(item)
  await api.post(`/modules/${moduleId}/materials`, materialBody(item, type, true))
}

export async function updateMaterial(materialId: number, item: CurriculumItem): Promise<void> {
  // PHP tidak membaca multipart pada PATCH: kirim POST dengan _method=PATCH.
  const body = materialBody(item, item.materialType ?? 'link', false)
  body.append('_method', 'PATCH')
  await api.post(`/materials/${materialId}`, body)
}

export async function removeMaterial(materialId: number): Promise<void> {
  await api.delete(`/materials/${materialId}`)
}

function sessionBody(item: CurriculumItem) {
  return {
    title: item.title,
    description: item.description || null,
    starts_at: `${item.date}T${item.startTime}:00`,
    ends_at: `${item.date}T${item.endTime}:00`,
    meeting_url: item.meetingLink,
  }
}

export async function createSession(courseId: number, item: CurriculumItem): Promise<void> {
  await api.post(`/courses/${courseId}/sessions`, sessionBody(item))
}

export async function updateSession(sessionId: number, item: CurriculumItem): Promise<void> {
  await api.patch(`/sessions/${sessionId}`, sessionBody(item))
}

export async function removeSession(sessionId: number): Promise<void> {
  await api.delete(`/sessions/${sessionId}`)
}
