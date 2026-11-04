import { Navigate, Route, Routes } from 'react-router-dom'
import CourseDetailPage from './courses/CourseDetailPage'
import CoursesListPage, { COURSES_PATH } from './courses/CoursesListPage'

/** Manajemen Kursus Admin. Sub-rute diatur di sini (menu "courses" bertanda nested di navigation.ts). */
export default function CoursesPage() {
  return (
    <Routes>
      <Route index element={<CoursesListPage />} />
      <Route path=":courseId" element={<CourseDetailPage />} />
      <Route path="*" element={<Navigate to={COURSES_PATH} replace />} />
    </Routes>
  )
}
