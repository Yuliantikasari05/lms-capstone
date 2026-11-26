import type { Course, CourseModule, CourseType, Material } from '../../features/courses/types'
import { API_BASE_URL } from '../../lib/api'
import type { CourseMaterialPreview, CourseModulePreview, MentorCoursePreview } from './courseData'

/** Ringkasan kursus untuk kartu di halaman Kursus Saya. */
export interface MentorCourseCard {
  id: number
  title: string
  description: string
  type: CourseType
  students: number
  sessions: number
  modules: number
  durationMinutes: number
}

/**
 * Menyesuaikan response API kursus (docs/api-kursus.md) ke bentuk yang sudah dipakai
 * komponen mentor, tanpa mengubah tampilan. Data yang belum tersedia (rating/ulasan/diskusi)
 * dikosongkan agar komponen menampilkan keadaan kosongnya, bukan angka contoh.
 */
export function toCourseCard(course: Course): MentorCourseCard {
  return {
    id: course.id,
    title: course.title,
    description: course.description ?? '',
    type: course.type,
    students: course.participants_count ?? 0,
    sessions: course.sessions_count ?? 0,
    modules: course.modules_count ?? 0,
    durationMinutes: course.duration_minutes ?? 0,
  }
}

function toMaterialPreview(material: Material): CourseMaterialPreview {
  return {
    id: String(material.id),
    title: material.title,
    description: material.description ?? '',
    type: material.type,
    durationMinutes: material.duration_minutes,
    xpPoints: material.xp_points,
    externalUrl: material.external_url,
    // File materi bersifat privat: hanya bisa diambil lewat endpoint ber-otorisasi ini.
    fileUrl: material.has_file ? `${API_BASE_URL}/materials/${material.id}/file` : null,
  }
}

export function toCoursePreview(course: Course, modules: CourseModule[]): MentorCoursePreview {
  return {
    id: course.id,
    title: course.title,
    description: course.description ?? '',
    type: course.type,
    rating: null,
    students: course.participants_count ?? 0,
    sessions: course.sessions_count ?? 0,
    modules: modules.map((module): CourseModulePreview => ({
      id: module.id,
      title: module.title,
      description: module.description ?? '',
      materials: (module.materials ?? []).map(toMaterialPreview),
    })),
    discussions: [],
    reviews: [],
  }
}
