import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState } from '../../components/ui/States'
import { DiscussionsTab } from './CourseDetail'
import { MENTOR_COURSES } from './courseData'

export default function CurriculumDiscussions() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const course = MENTOR_COURSES.find((item) => item.id === Number(courseId))

  if (!course) {
    return <EmptyState title="Kurikulum tidak ditemukan" description="Diskusi untuk kurikulum ini tidak tersedia." />
  }

  return (
    <div className="space-y-5">
      <Link to="/mentor/curriculum" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Kembali ke Kurikulum
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Diskusi · {course.title}</h1>
        <p className="mt-1 text-sm text-slate-500">Lihat dan kelola pertanyaan, balasan, serta diskusi peserta.</p>
      </header>
      <DiscussionsTab discussions={course.discussions} mentorName={user?.name ?? 'Mentor'} />
    </div>
  )
}
